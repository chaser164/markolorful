// netlify/functions/word.js
import { createClient } from '@supabase/supabase-js';
import { CONFIG } from '../../src/config.js';

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Configuration - construct start date from config
const START_DATE = new Date(`${CONFIG.START_DATE}T${CONFIG.DAILY_RESET_HOUR_UTC.toString().padStart(2, '0')}:00:00Z`);

// Calculate average color from votes
function calculateAverageColor(votes) {
  if (!votes || votes.length === 0) {
    return null;
  }
  
  const totals = votes.reduce((acc, vote) => ({
    r: acc.r + vote.r,
    g: acc.g + vote.g,
    b: acc.b + vote.b
  }), { r: 0, g: 0, b: 0 });
  
  return {
    r: Math.round(totals.r / votes.length),
    g: Math.round(totals.g / votes.length),
    b: Math.round(totals.b / votes.length)
  };
}

async function getDailyWord() {
  try {
    // Get total word count from database
    const { count, error: countError } = await supabase
      .from('words')
      .select('*', { count: 'exact', head: true });

    if (countError) throw countError;

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
    
    // Calculate days since start date
    const daysSinceEpoch = Math.floor((currentBoundary - START_DATE) / (1000 * 60 * 60 * 24));
    
    // Use modulo to cycle through words
    const wordIndex = daysSinceEpoch % count;
    
    // Get the specific word from database (offset by wordIndex)
    const { data: wordData, error: wordError } = await supabase
      .from('words')
      .select('id, word')
      .order('id')
      .range(wordIndex, wordIndex)
      .single();

    if (wordError) throw wordError;

    // Get all votes for this word (just need RGB values for averaging)
    const { data: votes, error: votesError } = await supabase
      .from('votes')
      .select('r, g, b')
      .eq('word_id', wordData.id);

    if (votesError) throw votesError;

    // Calculate average color
    const averageColor = calculateAverageColor(votes);

    // Calculate next change time
    const nextBoundary = new Date(currentBoundary);
    nextBoundary.setUTCDate(nextBoundary.getUTCDate() + 1);
    
    return {
      id: wordData.id,
      word: wordData.word,
      index: wordIndex,
      total_words: count,
      date: currentBoundary.toISOString().split('T')[0],
      days_since_epoch: daysSinceEpoch,
      next_change_utc: nextBoundary.toISOString(),
      vote_count: votes ? votes.length : 0,
      average_color: averageColor
    };
  } catch (error) {
    console.error('Error fetching daily word:', error);
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
      const wordData = await getDailyWord();
      
      return {
        statusCode: 200,
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(wordData),
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