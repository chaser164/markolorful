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

async function getTodaysWordId() {
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
    
    // Get the specific word ID from database (offset by wordIndex)
    const { data: wordData, error: wordError } = await supabase
      .from('words')
      .select('id')
      .order('id')
      .range(wordIndex, wordIndex)
      .single();

    if (wordError) throw wordError;

    return wordData.id;
  } catch (error) {
    console.error('Error getting today\'s word ID:', error);
    throw error;
  }
}

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

async function getHistory() {
  try {
    // Get today's word ID to exclude it from history
    const todaysWordId = await getTodaysWordId();
    
    // Get all words that have votes, along with their vote data
    const { data: wordsWithVotes, error: wordsError } = await supabase
      .from('words')
      .select(`
        id,
        word,
        votes (r, g, b, vote_date)
      `)
      .not('votes', 'is', null)
      .neq('id', todaysWordId); // Exclude today's word

    if (wordsError) throw wordsError;

    // Process each word to calculate averages and format data
    const history = wordsWithVotes
      .filter(wordData => wordData.votes && wordData.votes.length > 0)
      .map((wordData, index) => {
        const averageColor = calculateAverageColor(wordData.votes);
        
        // Get the earliest vote date for this word (for display purposes)
        const dates = wordData.votes.map(vote => vote.vote_date).sort();
        const earliestDate = dates[0];
        
        return {
          word: wordData.word,
          wordId: wordData.id,
          voteCount: wordData.votes.length,
          averageColor: averageColor,
          date: earliestDate, // First time this word received votes
          day: index + 1 // Sequential numbering for display
        };
      })
      // Sort by earliest vote date to show chronological order
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      // Update day numbers after sorting
      .map((entry, index) => ({
        ...entry,
        day: index + 1
      }))
      .reverse(); // Most recent first

    return history;
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
          total_words: history.length
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