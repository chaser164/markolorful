// netlify/functions/todays-votes.js
import { createClient } from '@supabase/supabase-js';
import { CONFIG } from '../../src/config.js';

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Configuration - construct start date from config
const START_DATE = new Date(`${CONFIG.START_DATE}T${CONFIG.DAILY_RESET_HOUR_UTC.toString().padStart(2, '0')}:00:00Z`);

function getCurrentVotingPeriod() {
  // Get current time in UTC and adjust for daily reset hour boundary
  const nowUtc = new Date();
  
  let currentBoundary;
  if (nowUtc.getUTCHours() < CONFIG.DAILY_RESET_HOUR_UTC) {
    // Before reset hour UTC, use previous day's boundary
    currentBoundary = new Date(nowUtc);
    currentBoundary.setUTCDate(currentBoundary.getUTCDate() - 1);
    currentBoundary.setUTCHours(CONFIG.DAILY_RESET_HOUR_UTC, 0, 0, 0);
  } else {
    // After reset hour UTC, use today's boundary
    currentBoundary = new Date(nowUtc);
    currentBoundary.setUTCHours(CONFIG.DAILY_RESET_HOUR_UTC, 0, 0, 0);
  }
  
  return {
    date: currentBoundary.toISOString().split('T')[0],
    boundary: currentBoundary
  };
}

async function getTodaysVotes() {
  try {
    const { date, boundary } = getCurrentVotingPeriod();
    
    // Get votes for today's voting period
    const { data: votes, error } = await supabase
      .from('votes')
      .select('r, g, b, created_at')
      .eq('vote_date', date)
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    return {
      date: date,
      votes: votes || [],
      vote_count: votes ? votes.length : 0,
      voting_period_start: boundary.toISOString(),
      voting_period_end: new Date(boundary.getTime() + 24 * 60 * 60 * 1000).toISOString()
    };
  } catch (error) {
    console.error('Error fetching today\'s votes:', error);
    throw error;
  }
}

export const handler = async (event, context) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  };

  // Handle OPTIONS request for CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  // Handle GET request
  if (event.httpMethod === 'GET') {
    try {
      const votesData = await getTodaysVotes();
      
      return {
        statusCode: 200,
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(votesData),
      };
    } catch (error) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Internal server error' }),
      };
    }
  }

  // Method not allowed
  return {
    statusCode: 405,
    headers,
    body: JSON.stringify({ error: 'Method not allowed' }),
  };
}; 