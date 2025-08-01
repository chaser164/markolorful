import { useState, useEffect, useRef } from 'react'
import FingerprintJS from '@fingerprintjs/fingerprintjs'
import { CONFIG } from './config'
import './App.css'

function App() {
  const [currentWord, setCurrentWord] = useState('')
  const [wordData, setWordData] = useState(null)
  const [backgroundColor, setBackgroundColor] = useState('#ffffff')
  const [textColor, setTextColor] = useState('#000000')
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [selectedColor, setSelectedColor] = useState('#ffffff')
  const [hasVotedToday, setHasVotedToday] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [fingerprint, setFingerprint] = useState(null)
  const [todaysVoteCount, setTodaysVoteCount] = useState(0)
  const [todaysAverageColor, setTodaysAverageColor] = useState(null)
  const [isVoting, setIsVoting] = useState(false)
  const [userVotedColor, setUserVotedColor] = useState(null)
  const [currentView, setCurrentView] = useState('home') // 'home', 'history', or 'info'
  const [hasAnimated, setHasAnimated] = useState(false)
  const [historyData, setHistoryData] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const colorInputRef = useRef(null)

  const API_BASE = CONFIG.API_BASE

  // Initialize fingerprinting
  useEffect(() => {
    const initFingerprint = async () => {
      try {
        const fp = await FingerprintJS.load()
        const result = await fp.get()
        setFingerprint(result.visitorId)
      } catch (error) {
        console.error('Error initializing fingerprint:', error)
        // Fallback to a simple browser fingerprint
        const fallbackFingerprint = `${navigator.userAgent}_${screen.width}x${screen.height}_${navigator.language}_${new Date().toDateString()}`
        setFingerprint(btoa(fallbackFingerprint))
      }
    }
    initFingerprint()
  }, [])



  // Check voting status from backend (and sync with localStorage)
  const checkVotingStatus = async () => {
    if (!fingerprint) return
    
    try {
      // Check with backend first (only if we have a current word)
      if (!currentWord) return
      
      const response = await fetch(`${API_BASE}/check-vote-status?fingerprint=${encodeURIComponent(fingerprint)}&word=${encodeURIComponent(currentWord)}`)
      const data = await response.json()
      
      if (response.ok) {
        const { hasVoted, userVote, word } = data
        
        // Update state based on backend response
        setHasVotedToday(hasVoted)
        setUserVotedColor(hasVoted ? userVote : null)
        
        // Sync localStorage with backend state
        const voteKey = `vote_${fingerprint}_${word}`
        const colorKey = `color_${fingerprint}_${word}`
        
        if (hasVoted) {
          localStorage.setItem(voteKey, 'true')
          if (userVote) {
            localStorage.setItem(colorKey, JSON.stringify(userVote))
          }
        } else {
          localStorage.removeItem(voteKey)
          localStorage.removeItem(colorKey)
        }
        
        // Clean up old localStorage entries from different words
        Object.keys(localStorage).forEach(key => {
          if ((key.startsWith('vote_') || key.startsWith('color_')) && !key.includes(word)) {
            localStorage.removeItem(key)
          }
        })
      } else {
        console.error('Error checking vote status:', data.error)
        // Fallback to localStorage check
        fallbackToLocalStorageCheck()
      }
    } catch (error) {
      console.error('Error checking vote status:', error)
      // Fallback to localStorage check
      fallbackToLocalStorageCheck()
    }
  }
  
  // Fallback function for localStorage-only check
  const fallbackToLocalStorageCheck = () => {
    if (!currentWord) return
    
    const voteKey = `vote_${fingerprint}_${currentWord}`
    const colorKey = `color_${fingerprint}_${currentWord}`
    const hasVoted = localStorage.getItem(voteKey) === 'true'
    
    setHasVotedToday(hasVoted)
    
    if (hasVoted) {
      const storedColor = localStorage.getItem(colorKey)
      if (storedColor) {
        try {
          setUserVotedColor(JSON.parse(storedColor))
        } catch (error) {
          console.error('Error parsing stored user color:', error)
        }
      }
    } else {
      setUserVotedColor(null)
    }
  }

  // Convert hex to RGB
  const hexToRgb = (hex) => {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return { r, g, b }
  }

  // Convert RGB to hex
  const rgbToHex = (r, g, b) => {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)
  }

  // Calculate color similarity (0-100%)
  const calculateColorSimilarity = (color1, color2) => {
    const rDiff = Math.abs(color1.r - color2.r)
    const gDiff = Math.abs(color1.g - color2.g)
    const bDiff = Math.abs(color1.b - color2.b)
    const maxDiff = Math.sqrt(3 * 255 * 255) // Maximum possible difference
    const actualDiff = Math.sqrt(rDiff * rDiff + gDiff * gDiff + bDiff * bDiff)
    return Math.round((1 - actualDiff / maxDiff) * 100)
  }

  // Get average color hex from RGB object
  const getAverageColorHex = (averageColor) => {
    if (!averageColor) return '#ffffff'
    return rgbToHex(averageColor.r, averageColor.g, averageColor.b)
  }

  // Load daily word from backend
  useEffect(() => {
    const loadDailyWord = async () => {
      try {
        setIsLoading(true)
        const response = await fetch(`${API_BASE}/word`)
        if (!response.ok) {
          throw new Error('Failed to fetch daily word')
        }
        const data = await response.json()
        setWordData(data)
        setCurrentWord(data.word)
        setTodaysVoteCount(data.vote_count || 0)
        setTodaysAverageColor(data.average_color)
        setError(null)
      } catch (error) {
        console.error('Error loading daily word:', error)
        setError('Failed to load daily word')
        setCurrentWord('markolorful') // Fallback
      } finally {
        setIsLoading(false)
      }
    }
    loadDailyWord()
  }, [])

  // Today's colors will be loaded with the word data

  // Check voting status when fingerprint and word are ready
  useEffect(() => {
    if (fingerprint && currentWord) {
      // Clear any old localStorage entries with incorrect format (one-time cleanup)
      const correctKey = `vote_${fingerprint}_${currentWord}`
      const correctColorKey = `color_${fingerprint}_${currentWord}`
      
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith(`vote_${fingerprint}_`) && key !== correctKey) {
          localStorage.removeItem(key)
        }
        if (key.startsWith(`color_${fingerprint}_`) && key !== correctColorKey) {
          localStorage.removeItem(key)
        }
      })
      
      checkVotingStatus()
    }
  }, [fingerprint, currentWord])

  // Set initial background based on voting status and today's average color with animation
  useEffect(() => {
    if (fingerprint !== null && todaysVoteCount >= 0 && !isLoading) {
      // Immediate background color to prevent flash
      if (hasVotedToday && todaysVoteCount > 0) {
        // User has voted - set to average of all today's votes
        const averageColorHex = getAverageColorHex(todaysAverageColor)
        setBackgroundColor(averageColorHex)
      } else {
        // User hasn't voted or no votes yet - set to white background
        setBackgroundColor('#ffffff')
      }
      
      // Quick animation trigger
      setTimeout(() => {
        setHasAnimated(true)
      }, 50)
    }
  }, [fingerprint, todaysVoteCount, todaysAverageColor, hasVotedToday, isLoading])

  // Calculate text color based on background brightness
  const getContrastColor = (hexColor) => {
    const r = parseInt(hexColor.slice(1, 3), 16)
    const g = parseInt(hexColor.slice(3, 5), 16)
    const b = parseInt(hexColor.slice(5, 7), 16)
    
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    
    return luminance > 0.5 ? '#000000' : '#ffffff'
  }

  // Update text color when background changes
  useEffect(() => {
    const newTextColor = getContrastColor(backgroundColor)
    setTextColor(newTextColor)
  }, [backgroundColor])



  // Handle color picker change (live preview)
  const handleColorChange = (e) => {
    const newColor = e.target.value
    setSelectedColor(newColor)
    setBackgroundColor(newColor) // Live preview
  }

  // Show color picker - open native color picker immediately
  const showColorChooser = () => {
    if (hasVotedToday) {
      // alert('You have already voted today! Come back tomorrow for the next word.')
      return
    }
    
    setShowColorPicker(true)
    setSelectedColor(backgroundColor)
    // Trigger the hidden color input
    setTimeout(() => {
      if (colorInputRef.current) {
        colorInputRef.current.click()
      }
    }, 100)
  }

  // Submit color vote to backend
  const submitColorVote = async (hexColor) => {
    try {
      setIsVoting(true)
      const rgb = hexToRgb(hexColor)
      
      const response = await fetch(`${API_BASE}/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          r: rgb.r,
          g: rgb.g,
          b: rgb.b,
          word: currentWord,
          fingerprint: fingerprint
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to submit vote')
      }

      const result = await response.json()
      
      // Mark as voted in localStorage using word
      const voteKey = `vote_${fingerprint}_${currentWord}`
      const colorKey = `color_${fingerprint}_${currentWord}`
      localStorage.setItem(voteKey, 'true')
      localStorage.setItem(colorKey, JSON.stringify({ r: rgb.r, g: rgb.g, b: rgb.b }))
      setHasVotedToday(true)
      
      // Update vote count and store user's vote
      setTodaysVoteCount(todaysVoteCount + 1)
      setUserVotedColor({ r: rgb.r, g: rgb.g, b: rgb.b })
      
      // Update average color calculation
      if (todaysAverageColor) {
        const newTotalVotes = todaysVoteCount + 1
        const newAverage = {
          r: Math.round((todaysAverageColor.r * todaysVoteCount + rgb.r) / newTotalVotes),
          g: Math.round((todaysAverageColor.g * todaysVoteCount + rgb.g) / newTotalVotes),
          b: Math.round((todaysAverageColor.b * todaysVoteCount + rgb.b) / newTotalVotes)
        }
        setTodaysAverageColor(newAverage)
      } else {
        // First vote
        setTodaysAverageColor({ r: rgb.r, g: rgb.g, b: rgb.b })
      }
      
      return result
    } catch (error) {
      console.error('Error submitting vote:', error)
      throw error
    } finally {
      setIsVoting(false)
    }
  }

  // Confirm color choice and submit vote
  const confirmColor = async () => {
    try {
      await submitColorVote(selectedColor)
      // Set background to new average color
      const averageColorHex = getAverageColorHex(todaysAverageColor)
      setBackgroundColor(averageColorHex)
      setShowColorPicker(false)
      // alert('Your color vote has been recorded! Thank you for participating.')
    } catch (error) {
      // alert(`Error: ${error.message}`)
    }
  }

  // Cancel color selection
  const cancelColor = () => {
    setBackgroundColor('#ffffff') // Reset to white
    setSelectedColor('#ffffff')
    setShowColorPicker(false)
  }

  // Load history data
  const loadHistory = async () => {
    setHistoryLoading(true)
    try {
      const response = await fetch(`${API_BASE}/history`)
      if (response.ok) {
        const data = await response.json()
        setHistoryData(data.history || [])
      }
    } catch (error) {
      console.error('Error loading history:', error)
    } finally {
      setHistoryLoading(false)
    }
  }

  // Switch to history view
  const showHistory = () => {
    setCurrentView('history')
    loadHistory()
  }

  // Switch to info view
  const showInfo = () => {
    setCurrentView('info')
  }

  // Switch back to home view
  const showHome = () => {
    setCurrentView('home')
  }

  // Get new word (disabled - now shows daily word only)
  const handleWordClick = () => {
    if (wordData) {
      // alert(`Today's word is "${wordData.word}" (${wordData.index + 1}/${wordData.total_words})\nThis word changes every 24 hours!`)
    }
  }

  if (isLoading) {
    return (
      <div className="app loading">
        <div className="content">
          <h1>Loading today's word...</h1>
        </div>
      </div>
    )
  }

  // History loading screen
  if (currentView === 'history' && historyLoading) {
    return (
      <div className="app loading" style={{ backgroundColor: '#ffffff' }}>
        <div className="content">
          <h1 style={{ color: '#000000' }}>Loading history...</h1>
        </div>
      </div>
    )
  }

  // Navbar component
  const Navbar = () => (
    <div 
      className="navbar"
      style={{
        position: 'static',
        height: '60px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-start',
        gap: '40px',
        paddingLeft: '40px',
        color: currentView === 'home' ? textColor : '#000000'
      }}
    >
      <button
        onClick={showHome}
        style={{
          background: 'none',
          border: 'none',
          fontSize: '20px',
          fontWeight: currentView === 'home' ? '600' : '400',
          cursor: 'pointer',
          color: 'inherit',
          textDecoration: currentView === 'home' ? 'underline' : 'none',
          textUnderlineOffset: '4px'
        }}
      >
        Markolorful
      </button>
      <button
        onClick={showHistory}
        style={{
          background: 'none',
          border: 'none',
          fontSize: '16px',
          fontWeight: currentView === 'history' ? '600' : '400',
          cursor: 'pointer',
          color: 'inherit',
          textDecoration: currentView === 'history' ? 'underline' : 'none',
          textUnderlineOffset: '4px'
        }}
      >
        History
      </button>
      <button
        onClick={showInfo}
        style={{
          background: 'none',
          border: 'none',
          fontSize: '16px',
          fontWeight: currentView === 'info' ? '600' : '400',
          cursor: 'pointer',
          color: 'inherit',
          textDecoration: currentView === 'info' ? 'underline' : 'none',
          textUnderlineOffset: '4px'
        }}
      >
        About
      </button>
      </div>
  )

  return (
    <div 
      className="app-wrapper"
      style={{ 
        backgroundColor: currentView === 'home' ? backgroundColor : '#ffffff',
        color: currentView === 'home' ? textColor : '#000000',
        minHeight: '100vh',
        transition: 'background-color 0.6s cubic-bezier(0.4, 0, 0.2, 1)'
      }}
    >
      <Navbar />
      <div 
        className="app" 
        style={{ 
          paddingTop: '0px',
          backgroundColor: 'transparent',
          ...((currentView === 'history' || currentView === 'info') && {
            alignItems: 'flex-start',
            justifyContent: 'flex-start',
            padding: 0
          })
        }}
      >
        {currentView === 'home' && (
          // HOME VIEW
          <div className={`content ${!isLoading && hasAnimated ? 'loaded' : ''}`}>
            <h1 className={`word ${!isLoading && hasAnimated ? 'word-loaded' : ''}`} onClick={handleWordClick}>
              {hasAnimated ? currentWord : '\u00A0'}
            </h1>
            
            {error && <p className="error">{error}</p>}
            
            <div className={`word-info ${!isLoading ? 'fade-in-delayed' : ''}`}>
              {wordData && (
                <p>Word {wordData.index + 1} • {wordData.date}</p>
              )}
            </div>

            {!hasVotedToday && !showColorPicker && (
              <button 
                className={`choose-color-btn ${!isLoading ? 'slide-up' : ''}`}
                onClick={showColorChooser}
                style={{
                  backgroundColor: textColor,
                  color: backgroundColor,
                  border: `2px solid ${textColor}`
                }}
              >
                Choose This Word's Color
              </button>
            )}

            {showColorPicker && (
              <div className="color-picker-section fade-in-scale">
                <div className="picker-actions">
                  <button 
                    className="confirm-btn"
                    onClick={confirmColor}
                    disabled={isVoting}
                    style={{
                      backgroundColor: textColor,
                      color: backgroundColor,
                      border: `2px solid ${textColor}`,
                      opacity: isVoting ? 0.6 : 1
                    }}
                  >
                    {isVoting ? 'Voting...' : 'Confirm Vote'}
                  </button>
                  <button 
                    className="cancel-btn"
                    onClick={cancelColor}
                    disabled={isVoting}
                    style={{
                      backgroundColor: 'transparent',
                      color: textColor,
                      border: `2px solid ${textColor}`,
                      opacity: isVoting ? 0.6 : 1
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Show vote comparison after user has voted */}
            {hasVotedToday && userVotedColor && todaysVoteCount > 0 && (
              <div className={`vote-comparison ${!isLoading ? 'fade-in-up' : ''}`}>
                <div className="comparison-row">
                  <div className="color-section">
                    <p className="color-label">Your Vote</p>
                    <div 
                      className="color-box"
                      style={{
                        backgroundColor: `rgb(${userVotedColor.r}, ${userVotedColor.g}, ${userVotedColor.b})`,
                        width: '80px',
                        height: '80px',
                        borderRadius: '12px',
                        border: '3px solid rgba(255, 255, 255, 0.3)',
                        cursor: 'pointer',
                        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)'
                      }}
                      onClick={() => setBackgroundColor(rgbToHex(userVotedColor.r, userVotedColor.g, userVotedColor.b))}
                      title="Click to use your color as background"
                    />
                  </div>
                  
                  <div className="color-section">
                    <p className="color-label">Community Blend</p>
                    {(() => {
                      const avgColorHex = getAverageColorHex(todaysAverageColor)
                      return (
                        <div 
                          className="color-box"
                          style={{
                            backgroundColor: avgColorHex,
                            width: '80px',
                            height: '80px',
                            borderRadius: '12px',
                            border: '3px solid rgba(255, 255, 255, 0.3)',
                            cursor: 'pointer',
                            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)'
                          }}
                          onClick={() => setBackgroundColor(avgColorHex)}
                          title="Click to use community average as background"
                        />
                      )
                    })()}
                  </div>
                </div>
                
                <div className="similarity-stats">
                  {(() => {
                    const similarity = todaysAverageColor ? calculateColorSimilarity(userVotedColor, todaysAverageColor) : 100
                    return (
                      <>
                        <div className="similarity-percentage">
                          {similarity}% similarity
                        </div>
                        <div className="vote-count">
                          {todaysVoteCount} vote{todaysVoteCount !== 1 ? 's' : ''} today
                        </div>
                      </>
                    )
                  })()}
                </div>
              </div>
            )}
          </div>
        )}

        {currentView === 'history' && (
          // HISTORY VIEW - Full Screen Layout
          <div className="history-fullscreen" style={{ paddingTop: '20px' }}>
            {historyData.length > 0 ? (
              historyData.map((entry, index) => (
                <div 
                  key={index} 
                  className="history-fullscreen-entry"
                  style={{
                    width: '100vw',
                    height: '140px',
                    backgroundColor: entry.averageColor 
                      ? `rgb(${entry.averageColor.r}, ${entry.averageColor.g}, ${entry.averageColor.b})`
                      : '#ffffff',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '20px 40px',
                    borderBottom: '1px solid #ccc',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    position: 'relative',
                    animation: `historySlideIn 0.6s ease-out ${(index + 1) * 0.1}s both`
                  }}
                >
                  <div 
                    className="history-word-fullscreen"
                    style={{
                      fontSize: 'clamp(2rem, 8vw, 4rem)',
                      fontWeight: '300',
                      color: entry.averageColor ? getContrastColor(
                        `rgb(${entry.averageColor.r}, ${entry.averageColor.g}, ${entry.averageColor.b})`
                      ) : '#000000',
                      letterSpacing: '-0.02em',
                      textAlign: 'center',
                      marginBottom: '8px'
                    }}
                  >
                    {entry.word}
                  </div>
                  <div 
                    className="history-date-fullscreen"
                    style={{
                      fontSize: '14px',
                      opacity: 0.7,
                      color: entry.averageColor ? getContrastColor(
                        `rgb(${entry.averageColor.r}, ${entry.averageColor.g}, ${entry.averageColor.b})`
                      ) : '#000000',
                      textAlign: 'center'
                    }}
                  >
                    Word {entry.day} • {entry.date}
                  </div>
                  <div 
                    className="history-votes-fullscreen"
                    style={{
                      position: 'absolute',
                      top: '20px',
                      right: '20px',
                      fontSize: '14px',
                      fontWeight: '500',
                      color: entry.averageColor ? getContrastColor(
                        `rgb(${entry.averageColor.r}, ${entry.averageColor.g}, ${entry.averageColor.b})`
                      ) : '#000000',
                      opacity: 0.8
                    }}
                  >
                    {entry.voteCount} vote{entry.voteCount !== 1 ? 's' : ''}
                  </div>
                </div>
              ))
            ) : (
              <div style={{
                width: '100vw',
                height: '140px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#ffffff',
                borderBottom: '1px solid #ccc',
                animation: 'historySlideIn 0.6s ease-out 0.2s both'
              }}>
                <p style={{ color: '#000000', margin: 0, fontSize: '18px' }}>No history available yet.</p>
              </div>
            )}
          </div>
        )}

        {currentView === 'info' && (
          <div style={{ 
            paddingTop: '20px', 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 'calc(100vh - 80px)', // Account for navbar height
            width: '100%',
            maxWidth: '600px',
            margin: '0 auto',
            padding: '2rem'
          }}>
            {/* <h1 style={{ color: '#000000', fontSize: '32px', fontWeight: '300', letterSpacing: '-0.02em', textAlign: 'left', width: '100%', marginBottom: '2rem' }}>
              About
            </h1> */}
            <div style={{ color: '#000000', fontSize: '18px', textAlign: 'left', lineHeight: '1.6', width: '100%' }}>
              <p>
                Welcome to <strong>Markolorful</strong>! Each day brings a new word generated using Markov chains, and the community votes on colors to create a collective visual experience.
              </p>
              
              {wordData && (
                <div style={{ margin: '30px 0', padding: '20px', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
                  <h3 style={{ margin: '0 0 10px 0', fontSize: '20px', fontWeight: '500' }}>Today's Word</h3>
                  <p style={{ margin: '5px 0', fontSize: '16px' }}>
                    <strong>{wordData.word}</strong> • Day {wordData.index + 1} • {wordData.date}
                  </p>
                  {wordData.next_change_utc && (
                    <p style={{ margin: '10px 0 0 0', fontSize: '14px', opacity: 0.8 }}>
                      Next word: {new Date(wordData.next_change_utc).toLocaleDateString('en-CA')} at {new Date(wordData.next_change_utc).toLocaleTimeString('en-US', {hour: 'numeric', minute: '2-digit'})}{' '}
                      ({Intl.DateTimeFormat().resolvedOptions().timeZone})
                    </p>
                  )}
                </div>
              )}

              <p>
                After voting, you can check out the "Community Blend" to see the average color of all votes for that day's word.
                The percentage similarity shows how close your vote is to the community blend.
              </p>

              <br />
              <p>
                Words are created using <strong>Markov chains</strong> - an algorithm that learns patterns from classic literature, song lyrics, and other texts to generate new, unique words that sound naturally interesting.
              </p>
              
              <p>
                Visit the History tab to see how colors have evolved over time - each word gets its own blended color timeline entry.
              </p>

              <div style={{ margin: '40px 0', padding: '20px', backgroundColor: '#f0f8ff', borderRadius: '8px', border: '2px solid #e1f5fe' }}>
                <h3 style={{ margin: '0 0 15px 0', fontSize: '20px', fontWeight: '500' }}>Open Source</h3>
                <p style={{ margin: '10px 0', fontSize: '16px' }}>
                  This project is open source! Check out the code, contribute features, or learn how the Markov chain algorithm works on{' '}
                  <a 
                    href="https://github.com/chaser164/markolorful"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#1976d2', textDecoration: 'underline' }}
                  >
                    GitHub
                  </a>
                  .
                </p>
                <p style={{ margin: '5px 0 0 0', fontSize: '14px', opacity: 0.8 }}>
                  Contributions welcome!
                </p>
              </div>
            </div>
          </div>
        )}
        
        {/* Hidden color input positioned at bottom of screen */}
        <input
          ref={colorInputRef}
          type="color"
          value={selectedColor}
          onChange={handleColorChange}
          className="hidden-color-input"
        />
      </div>
    </div>
  )
}

export default App
