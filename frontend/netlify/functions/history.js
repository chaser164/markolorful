// netlify/functions/history.js
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

async function getHistory() {
  try {
    // Get total word count
    const { count: totalWords, error: countError } = await supabase
      .from('words')
      .select('*', { count: 'exact', head: true });

    if (countError) throw countError;

    // Calculate how many days have passed since start
    const { boundary: currentBoundary } = getCurrentVotingPeriod();
    const daysSinceStart = Math.floor((currentBoundary - START_DATE) / (1000 * 60 * 60 * 24));
    
    const history = [];

    // Go through each day from start to previous day (exclude current day)
    for (let day = 0; day < daysSinceStart; day++) {
      const wordIndex = day % totalWords;
      const dayBoundary = new Date(START_DATE.getTime() + day * 24 * 60 * 60 * 1000);
      const dateString = dayBoundary.toISOString().split('T')[0];

      // Get the word for this day
      const { data: wordData, error: wordError } = await supabase
        .from('words')
        .select('id, word')
        .order('id')
        .range(wordIndex, wordIndex)
        .single();

      if (wordError) {
        console.error(`Error fetching word for day ${day}:`, wordError);
        continue;
      }

      // Get votes for this day
      const { data: votes, error: votesError } = await supabase
        .from('votes')
        .select('r, g, b')
        .eq('vote_date', dateString);

      if (votesError) {
        console.error(`Error fetching votes for ${dateString}:`, votesError);
      }

      // Calculate average color if there are votes
      let averageColor = null;
      if (votes && votes.length > 0) {
        const totals = votes.reduce((acc, vote) => ({
          r: acc.r + vote.r,
          g: acc.g + vote.g,
          b: acc.b + vote.b
        }), { r: 0, g: 0, b: 0 });

        averageColor = {
          r: Math.round(totals.r / votes.length),
          g: Math.round(totals.g / votes.length),
          b: Math.round(totals.b / votes.length)
        };
      }

      history.push({
        date: dateString,
        day: day + 1,
        word: wordData.word,
        wordId: wordData.id,
        voteCount: votes ? votes.length : 0,
        averageColor: averageColor
      });
    }

    // Reverse to show most recent first
    return history.reverse();
  } catch (error) {
    console.error('Error fetching history:', error);
    throw error;
  }
}

export const handler = async (event, context) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
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
      const history = await getHistory();
      
      return {
        statusCode: 200,
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          history: history,
          total_days: history.length
        }),
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