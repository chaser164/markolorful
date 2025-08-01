import { createClient } from '@supabase/supabase-js'
import { CONFIG } from '../../src/config.js'

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Function to get the current voting period (daily reset hour UTC boundary)
function getCurrentVotingPeriod() {
  const now = new Date()
  const utcHour = now.getUTCHours()
  
  if (utcHour >= CONFIG.DAILY_RESET_HOUR_UTC) {
    // Same day (after reset hour UTC)
    return now.toISOString().split('T')[0]
  } else {
    // Previous day (before reset hour UTC)
    const yesterday = new Date(now)
    yesterday.setUTCDate(yesterday.getUTCDate() - 1)
    return yesterday.toISOString().split('T')[0]
  }
}

export const handler = async (event, context) => {
  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS'
  }

  // Handle preflight request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers
    }
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  try {
    const fingerprint = event.queryStringParameters?.fingerprint
    
    if (!fingerprint) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Fingerprint is required' })
      }
    }

    const currentVotingPeriod = getCurrentVotingPeriod()

    // Check if user has already voted today
    const { data: existingVote, error: voteError } = await supabase
      .from('votes')
      .select('r, g, b')
      .eq('fingerprint', fingerprint)
      .eq('vote_date', currentVotingPeriod)
      .single()

    if (voteError && voteError.code !== 'PGRST116') {
      throw voteError
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        hasVoted: !!existingVote,
        userVote: existingVote ? { r: existingVote.r, g: existingVote.g, b: existingVote.b } : null,
        votingPeriod: currentVotingPeriod
      })
    }

  } catch (error) {
    console.error('Error checking vote status:', error)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' })
    }
  }
} 