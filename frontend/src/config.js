// Application configuration constants
export const CONFIG = {
  // Hour (UTC) when the daily word and voting period resets
  DAILY_RESET_HOUR_UTC: 7,
  
  // Start date for the application (date string in YYYY-MM-DD format)
  START_DATE: '2025-07-30',
  
  // API base URL
  API_BASE: process.env.NODE_ENV === 'development' 
    ? 'http://localhost:8888/.netlify/functions' 
    : '/.netlify/functions'
} 