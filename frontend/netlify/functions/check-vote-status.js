import { createClient } from '@supabase/supabase-js'

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function getWordId(word) {
  try {
    // Look up the word ID by the word text
    const { data: wordData, error: wordError } = await supabase
      .from('words')
      .select('id')
      .eq('word', word)
      .single();

    if (wordError) {
      if (wordError.code === 'PGRST116') {
        throw new Error('Word not found');
      }
      throw wordError;
    }

    return wordData.id;
  } catch (error) {
    console.error('Error getting word ID:', error);
    throw error;
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
    const word = event.queryStringParameters?.word
    
    if (!fingerprint) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Fingerprint is required' })
      }
    }

    if (!word) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Word is required' })
      }
    }

    // Get the word ID
    const wordId = await getWordId(word);

    // Check if user has already voted for this word
    const { data: existingVote, error: voteError } = await supabase
      .from('votes')
      .select('r, g, b, color_name')
      .eq('fingerprint', fingerprint)
      .eq('word_id', wordId)
      .single()

    if (voteError && voteError.code !== 'PGRST116') {
      throw voteError
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        hasVoted: !!existingVote,
        userVote: existingVote ? { 
          r: existingVote.r, 
          g: existingVote.g, 
          b: existingVote.b,
          color_name: existingVote.color_name 
        } : null,
        word: word,
        word_id: wordId
      })
    }

  } catch (error) {
    console.error('Error checking vote status:', error)
    
    if (error.message === 'Word not found') {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Word not found' })
      }
    }

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' })
    }
  }
} 