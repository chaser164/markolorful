# Markolorful

**Daily Color Voting for Markov-Generated Words**

*Chase Reynders*

## Overview

Markolorful is a collaborative daily color voting experience where the community associates colors with algorithmically-generated words. Each day features a new word created using Markov chains, and users vote on colors to create a collective visual representation. The background color represents the average of all community votes for that day's word.

## How It Works

### Daily Cycle
- **New Word**: Every day at 7:00 AM UTC, a new word appears
- **Community Voting**: Users vote on colors throughout the day
- **Live Background**: The background shows the average of all votes
- **History**: Previous days create a colorful timeline of words and community choices

### Voting System
- **One Vote Per Day**: Browser fingerprinting ensures each user votes once per day
- **Color Averaging**: All votes are averaged using RGB values to create the community color
- **Live Preview**: Users see their color choice immediately, then the community average after voting
- **Similarity Scoring**: Users see how similar their choice was to the community average

## Architecture

### Frontend
- **React/Vite**: Modern frontend framework with fast development
- **Netlify Hosting**: Static site hosting with automatic deployments
- **Responsive Design**: Adapts to all screen sizes with dynamic contrast adjustment

### Backend Security
**🔒 All Supabase communication happens exclusively through Netlify Functions** - never directly from the frontend. This ensures:
- API keys remain secure on the server
- Database access is controlled and validated
- Rate limiting and abuse prevention
- Consistent data validation

### Netlify Functions (Serverless API)
- `word.js` - Retrieves today's markov-generated word
- `vote.js` - Processes color votes with validation and duplicate prevention
- `check-vote-status.js` - Verifies if user has already voted today
- `todays-votes.js` - Returns all votes for today's word
- `history.js` - Provides timeline of past words and their community colors

### Database (Supabase)
- **words** table: Stores markov-generated words
- **votes** table: Records user votes with RGB values, fingerprints, and timestamps
- **Environment Variables**: `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`

## Markov Chain Word Generation

### Algorithm Design
The word generation uses a **k-th order Markov chain** approach:

1. **Text Chunking**: Input text is divided into character chunks of size `k`
2. **Adjacency Lists**: Each chunk maps to possible following chunks
3. **Chain Building**: Creates transitions between character sequences
4. **Word Generation**: Follows probability paths to generate new words

### Implementation (`word-generation/markov.py`)
```bash
python markov.py <order> <file_path>
```

- **Order**: Determines chunk size (1 = single characters, 2 = pairs, etc.)
- **Input**: Text file for training the chain
- **Output**: Pseudo-random word following the statistical patterns of the input

### Text Sources
The system draws from diverse literary sources:
- Classic literature (Shakespeare, Aesop's Fables)
- Political speeches (Presidential debates)
- Song lyrics (Beatles, Taylor Swift, Pearl Jam)
- Reference materials (Wikipedia articles)
- And more!

### Word Curation Process (`generate_markov_words.sh`)
1. **Batch Generation**: Runs markov chain generation 10 times
2. **Random Sources**: Each run uses a different random text source
3. **Filtering**: Selects words between 5-14 characters in length
4. **Randomization**: Shuffles and selects 10 words per run
5. **Final Selection**: From the final list, I choose the most fun-sounding words to use!

## Sources & Inspiration

- [Princeton CS Markov Assignment](https://www.cs.princeton.edu/courses/archive/spring05/cos126/assignments/markov.html) - Original inspiration for markov chain implementation
- [Princeton Text Corpus](https://www.cs.princeton.edu/courses/archive/spr24/cos126/assignments/chat126/) - Source for many training texts
- [Taylor Swift Lyrics](https://github.com/irenetrampoline/taylor-swift-lyrics/blob/master/all_tswift_lyrics.txt) - Contemporary music corpus

# TODO
- same size nav bar
- compact nav bar for mobile
- consider adding a supabase function / reconfiguring history logic to compress data (?)
- website logo / Title 
- don't make history time-based, make it word-based!