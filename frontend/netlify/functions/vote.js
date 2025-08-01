// netlify/functions/vote.js
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

async function getDailyWordId() {
  try {
    // Get total word count from database
    const { count, error: countError } = await supabase
      .from('words')
      .select('*', { count: 'exact', head: true });

    if (countError) throw countError;

    // Calculate word index using same logic as word function
    const { boundary } = getCurrentVotingPeriod();
    const daysSinceEpoch = Math.floor((boundary - START_DATE) / (1000 * 60 * 60 * 24));
    const wordIndex = daysSinceEpoch % count;
    
    // Get the specific word ID from database
    const { data: wordData, error: wordError } = await supabase
      .from('words')
      .select('id')
      .order('id')
      .range(wordIndex, wordIndex)
      .single();

    if (wordError) throw wordError;

    return wordData.id;
  } catch (error) {
    console.error('Error getting daily word ID:', error);
    throw error;
  }
}

async function submitVote(r, g, b, fingerprint) {
  try {
    const { date } = getCurrentVotingPeriod();
    
    // Check if user already voted today
    const { data: existingVote, error: checkError } = await supabase
      .from('votes')
      .select('id')
      .eq('fingerprint', fingerprint)
      .eq('vote_date', date)
      .single();

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows found
      throw checkError;
    }

    if (existingVote) {
      throw new Error('User has already voted today');
    }

    // Get today's word ID
    const wordId = await getDailyWordId();

    // Insert the vote
    const { data, error } = await supabase
      .from('votes')
      .insert({
        word_id: wordId,
        r: r,
        g: g,
        b: b,
        vote_date: date,
        fingerprint: fingerprint
      })
      .select()
      .single();

    if (error) throw error;

    return {
      message: 'Vote recorded successfully',
      vote: {
        r: r,
        g: g,
        b: b,
        date: date
      }
    };
  } catch (error) {
    console.error('Error submitting vote:', error);
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

  // Handle POST request
  if (event.httpMethod === 'POST') {
    try {
      const body = JSON.parse(event.body);
      const { r, g, b, fingerprint } = body;

      // Validate input
      if (!fingerprint || typeof fingerprint !== 'string') {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Fingerprint is required' }),
        };
      }

      if (typeof r !== 'number' || typeof g !== 'number' || typeof b !== 'number') {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'RGB values must be numbers' }),
        };
      }

      if (r < 0 || r > 255 || g < 0 || g > 255 || b < 0 || b > 255) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'RGB values must be between 0 and 255' }),
        };
      }

      const result = await submitVote(r, g, b, fingerprint);
      
      return {
        statusCode: 201,
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(result),
      };
    } catch (error) {
      if (error.message === 'User has already voted today') {
        return {
          statusCode: 429,
          headers,
          body: JSON.stringify({ error: 'User has already voted today' }),
        };
      }

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