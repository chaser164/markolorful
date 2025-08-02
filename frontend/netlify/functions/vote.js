// netlify/functions/vote.js
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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

async function getColorName(r, g, b) {
  try {
    const response = await fetch(`https://www.thecolorapi.com/id?rgb=rgb(${r},${g},${b})`);
    
    if (!response.ok) {
      console.error('Color API request failed:', response.status, response.statusText);
      return null; // Return null if API fails, we'll handle this gracefully
    }
    
    const data = await response.json();
    return data?.name?.value || null;
  } catch (error) {
    console.error('Error fetching color name from API:', error);
    return null; // Return null if API fails, we'll handle this gracefully
  }
}

async function submitVote(r, g, b, word, fingerprint) {
  try {
    // Get the word ID
    const wordId = await getWordId(word);
    
    // Check if user already voted for this word
    const { data: existingVote, error: checkError } = await supabase
      .from('votes')
      .select('id')
      .eq('fingerprint', fingerprint)
      .eq('word_id', wordId)
      .single();

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows found
      throw checkError;
    }

    if (existingVote) {
      throw new Error('User has already voted for this word');
    }

    // Get the color name from the color API
    const colorName = await getColorName(r, g, b);

    // Insert the vote
    const { data, error } = await supabase
      .from('votes')
      .insert({
        word_id: wordId,
        r: r,
        g: g,
        b: b,
        color_name: colorName, // Add the color name to the database
        vote_date: new Date().toISOString().split('T')[0], // Current date for logging
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
        color_name: colorName,
        created_at: data.created_at,
        word: word,
        word_id: wordId
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
      const { r, g, b, word, fingerprint } = body;

      // Validate input
      if (!fingerprint || typeof fingerprint !== 'string') {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Fingerprint is required' }),
        };
      }

      if (!word || typeof word !== 'string') {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Word is required' }),
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

      const result = await submitVote(r, g, b, word, fingerprint);
      
      return {
        statusCode: 201,
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(result),
      };
    } catch (error) {
      if (error.message === 'User has already voted for this word') {
        return {
          statusCode: 429,
          headers,
          body: JSON.stringify({ error: 'User has already voted for this word' }),
        };
      }

      if (error.message === 'Word not found') {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Word not found' }),
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