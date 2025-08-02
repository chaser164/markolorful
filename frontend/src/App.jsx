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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [userVotedColorName, setUserVotedColorName] = useState(null)
  const [communityBlendColorName, setCommunityBlendColorName] = useState(null)
  const [mostPopularColor, setMostPopularColor] = useState(null)
  const [mostPopularColorName, setMostPopularColorName] = useState(null)
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
        
        // Set the user's color name if available
        if (hasVoted && userVote && userVote.color_name) {
          setUserVotedColorName(userVote.color_name)
        } else {
          setUserVotedColorName(null)
        }
        
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

  // Get average color hex from RGB object
  const getAverageColorHex = (averageColor) => {
    if (!averageColor) return '#ffffff'
    return rgbToHex(averageColor.r, averageColor.g, averageColor.b)
  }

  // Fetch color name from the color API
  const fetchColorName = async (r, g, b) => {
    try {
      const response = await fetch(`https://www.thecolorapi.com/id?rgb=rgb(${r},${g},${b})`)
      if (!response.ok) {
        console.error('Color API request failed:', response.status, response.statusText)
        return null
      }
      const data = await response.json()
      return data?.name?.value || null
    } catch (error) {
      console.error('Error fetching color name from API:', error)
      return null
    }
  }

  // Calculate the most popular (mode) color from votes
  const calculateMostPopularColor = (votes, userColor = null) => {
    if (!votes || votes.length === 0) {
      return null
    }

    // If only one vote, return it
    if (votes.length === 1) {
      return {
        r: votes[0].r,
        g: votes[0].g,
        b: votes[0].b,
        color_name: votes[0].color_name
      }
    }

    // Count occurrences of each color name (not RGB)
    const colorNameCounts = {}
    votes.forEach(vote => {
      if (vote.color_name) {
        const colorName = vote.color_name
        if (colorNameCounts[colorName]) {
          colorNameCounts[colorName].count++
          colorNameCounts[colorName].variants.push(vote)
        } else {
          colorNameCounts[colorName] = {
            count: 1,
            variants: [vote]
          }
        }
      }
    })

    // Find the maximum count by color name
    const maxCount = Math.max(...Object.values(colorNameCounts).map(c => c.count))

    // If max count is 1, all color names are equally popular - pick one randomly
    if (maxCount === 1) {
      const randomIndex = Math.floor(Math.random() * votes.length)
      return {
        r: votes[randomIndex].r,
        g: votes[randomIndex].g,
        b: votes[randomIndex].b,
        color_name: votes[randomIndex].color_name
      }
    }

    // Get all color names with the maximum count
    const mostPopularColorNames = Object.keys(colorNameCounts).filter(name => 
      colorNameCounts[name].count === maxCount
    )

    // If tie between color names, pick one randomly
    const randomNameIndex = Math.floor(Math.random() * mostPopularColorNames.length)
    const winningColorName = mostPopularColorNames[randomNameIndex]
    const winningColorVariants = colorNameCounts[winningColorName].variants

    // If user's color matches the winning color name, prefer their exact RGB
    if (userColor && userColor.color_name === winningColorName) {
      return {
        r: userColor.r,
        g: userColor.g,
        b: userColor.b,
        color_name: winningColorName
      }
    }

    // Otherwise, pick the earliest variant of the winning color name
    const sortedVariants = winningColorVariants.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    const selectedVariant = sortedVariants[0]

    return {
      r: selectedVariant.r,
      g: selectedVariant.g,
      b: selectedVariant.b,
      color_name: winningColorName
    }
  }

  // Calculate vote count for a specific color name (not RGB)
  const getColorNameVoteCount = (colorName, votes) => {
    if (!colorName || !votes || votes.length === 0) {
      return 0
    }
    
    return votes.filter(vote => vote.color_name === colorName).length
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

  // Close mobile menu on window resize
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 768 && isMobileMenuOpen) {
        setIsMobileMenuOpen(false)
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [isMobileMenuOpen])

  // Set initial background based on voting status and today's average color with animation
  useEffect(() => {
    if (fingerprint !== null && todaysVoteCount >= 0 && !isLoading) {
      // Immediate background color to prevent flash
      if (hasVotedToday && todaysVoteCount > 0) {
        // User has voted - set to their voted color, not the community blend
        if (userVotedColor) {
          const userColorHex = rgbToHex(userVotedColor.r, userVotedColor.g, userVotedColor.b)
          setBackgroundColor(userColorHex)
        } else {
          // Fallback to community blend if user color not available
          const averageColorHex = getAverageColorHex(todaysAverageColor)
          setBackgroundColor(averageColorHex)
        }
      } else {
        // User hasn't voted or no votes yet - set to white background
        setBackgroundColor('#ffffff')
      }
      
      // Quick animation trigger
      setTimeout(() => {
        setHasAnimated(true)
      }, 50)
    }
  }, [fingerprint, todaysVoteCount, todaysAverageColor, hasVotedToday, isLoading, userVotedColor])

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

  // Fetch community blend color name when average color changes
  useEffect(() => {
    const fetchCommunityColorName = async () => {
      if (todaysAverageColor && hasVotedToday) {
        const colorName = await fetchColorName(todaysAverageColor.r, todaysAverageColor.g, todaysAverageColor.b)
        setCommunityBlendColorName(colorName)
      }
    }
    
    fetchCommunityColorName()
  }, [todaysAverageColor, hasVotedToday])

  // Calculate most popular color when word data changes
  useEffect(() => {
    if (wordData && wordData.votes && hasVotedToday) {
      const mostPopular = calculateMostPopularColor(wordData.votes, userVotedColor)
      if (mostPopular) {
        setMostPopularColor(mostPopular)
        setMostPopularColorName(mostPopular.color_name)
      }
    }
  }, [wordData, hasVotedToday, userVotedColor])


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
      
      // Store the color name from the backend response
      if (result.vote && result.vote.color_name) {
        setUserVotedColorName(result.vote.color_name)
      }
      
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

      // Update vote data and recalculate most popular color
      if (wordData && wordData.votes) {
        const newVote = {
          r: rgb.r,
          g: rgb.g,
          b: rgb.b,
          color_name: result.vote?.color_name || null,
          created_at: result.vote?.created_at || new Date().toISOString()
        }
        const updatedVotes = [...wordData.votes, newVote]
        const updatedWordData = { ...wordData, votes: updatedVotes }
        setWordData(updatedWordData)
        
        // Recalculate most popular color
        const mostPopular = calculateMostPopularColor(updatedVotes, userVotedColor)
        if (mostPopular) {
          setMostPopularColor(mostPopular)
          setMostPopularColorName(mostPopular.color_name)
        }
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
        const history = data.history || []
        
        // Fetch color names for each history entry
        const historyWithColorNames = await Promise.all(
          history.map(async (entry) => {
            if (entry.averageColor) {
              const colorName = await fetchColorName(
                entry.averageColor.r, 
                entry.averageColor.g, 
                entry.averageColor.b
              )
              return { ...entry, colorName }
            }
            return entry
          })
        )
        
        setHistoryData(historyWithColorNames)
      }
    } catch (error) {
      console.error('Error loading history:', error)
    } finally {
      setHistoryLoading(false)
    }
  }

  // Switch back to home view
  const showHome = () => {
    setCurrentView('home')
    setIsMobileMenuOpen(false)
  }

  // Switch to history view
  const showHistory = () => {
    setCurrentView('history')
    loadHistory()
    setIsMobileMenuOpen(false)
  }

  // Switch to info view
  const showInfo = () => {
    setCurrentView('info')
    setIsMobileMenuOpen(false)
  }

  // Toggle mobile menu
  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen)
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

  // Hamburger icon component
  const HamburgerIcon = () => (
    <div className="hamburger-icon">
      <span></span>
      <span></span>
      <span></span>
    </div>
  )

  // Navbar component
  const Navbar = () => (
    <>
      {/* Desktop Navbar */}
      <div 
        className="navbar desktop-navbar"
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
            fontSize: '18px',
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
            fontSize: '18px',
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
            fontSize: '18px',
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

      {/* Mobile Navbar */}
      <div 
        className="navbar mobile-navbar"
        style={{
          position: 'static',
          height: '60px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingLeft: '20px',
          paddingRight: '20px',
          color: currentView === 'home' ? textColor : '#000000'
        }}
      >
        <span
          style={{
            fontSize: '18px',
            fontWeight: '600',
            color: 'inherit'
          }}
        >
          {currentView === 'home' ? 'Markolorful' : 
           currentView === 'history' ? 'History' : 
           currentView === 'info' ? 'About' : 'Markolorful'}
        </span>
        
        <button
          onClick={toggleMobileMenu}
          className="hamburger-button"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '8px',
            color: 'inherit'
          }}
        >
          <HamburgerIcon />
        </button>
      </div>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <>
          <div 
            className="mobile-menu-overlay"
            onClick={toggleMobileMenu}
          />
          <div className="mobile-menu">
            <button
              onClick={showHome}
              className={currentView === 'home' ? 'active' : ''}
            >
              Markolorful
            </button>
            <button
              onClick={showHistory}
              className={currentView === 'history' ? 'active' : ''}
            >
              History
            </button>
            <button
              onClick={showInfo}
              className={currentView === 'info' ? 'active' : ''}
            >
              About
            </button>
          </div>
        </>
      )}
    </>
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
                {/* Total vote count above all colors */}
                <p className="total-votes" style={{ 
                  fontSize: '16px', 
                  marginBottom: '1rem', 
                  opacity: 0.7,
                  textAlign: 'center',
                  fontWeight: '500',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  {todaysVoteCount} vote{todaysVoteCount !== 1 ? 's' : ''} today
                </p>
                
                {/* Horizontal line */}
                <div style={{ 
                  width: '100%',
                  height: '1px',
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  marginBottom: '1.5rem'
                }} />
                
                <div className="comparison-row">
                  <div className="color-section">
                    <p className="color-label">Your<br />Vote</p>
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
                    {userVotedColorName && (
                      <p className="color-name" style={{ 
                        fontSize: '14px', 
                        marginTop: '8px', 
                        opacity: 0.8,
                        textAlign: 'center',
                        fontWeight: '500',
                        fontStyle: 'italic'
                      }}>
                        "{userVotedColorName}"
                      </p>
                    )}
                    <p className="vote-count" style={{ 
                      fontSize: '12px', 
                      marginTop: '4px', 
                      opacity: 0.6,
                      textAlign: 'center',
                      fontWeight: '400'
                    }}>
                      {wordData && wordData.votes ? getColorNameVoteCount(userVotedColorName, wordData.votes) : 1} vote{wordData && wordData.votes && getColorNameVoteCount(userVotedColorName, wordData.votes) !== 1 ? 's' : ''}
                    </p>
                  </div>

                  {/* Community Blend in the middle */}
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
                    {communityBlendColorName && (
                      <p className="color-name" style={{ 
                        fontSize: '14px', 
                        marginTop: '8px', 
                        opacity: 0.8,
                        textAlign: 'center',
                        fontWeight: '500',
                        fontStyle: 'italic'
                      }}>
                        "{communityBlendColorName}"
                      </p>
                    )}
                    {/* Invisible placeholder to maintain alignment */}
                    <p style={{ 
                      fontSize: '12px', 
                      marginTop: '4px', 
                      opacity: 0,
                      textAlign: 'center',
                      fontWeight: '400',
                      visibility: 'hidden'
                    }}>
                      placeholder
                    </p>
                  </div>

                  {/* Most Popular Color Box */}
                  {mostPopularColor && (
                    <div className="color-section">
                      <p className="color-label">Most Popular</p>
                      <div 
                        className="color-box"
                        style={{
                          backgroundColor: `rgb(${mostPopularColor.r}, ${mostPopularColor.g}, ${mostPopularColor.b})`,
                          width: '80px',
                          height: '80px',
                          borderRadius: '12px',
                          border: '3px solid rgba(255, 255, 255, 0.3)',
                          cursor: 'pointer',
                          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)'
                        }}
                        onClick={() => setBackgroundColor(rgbToHex(mostPopularColor.r, mostPopularColor.g, mostPopularColor.b))}
                        title="Click to use most popular color as background"
                      />
                      {mostPopularColorName && (
                        <p className="color-name" style={{ 
                          fontSize: '14px', 
                          marginTop: '8px', 
                          opacity: 0.8,
                          textAlign: 'center',
                          fontWeight: '500',
                          fontStyle: 'italic'
                        }}>
                          "{mostPopularColorName}"
                        </p>
                      )}
                      <p className="vote-count" style={{ 
                        fontSize: '12px', 
                        marginTop: '4px', 
                        opacity: 0.6,
                        textAlign: 'center',
                        fontWeight: '400'
                      }}>
                        {wordData && wordData.votes ? getColorNameVoteCount(mostPopularColorName, wordData.votes) : 0} vote{wordData && wordData.votes && getColorNameVoteCount(mostPopularColorName, wordData.votes) !== 1 ? 's' : ''}
                      </p>
                    </div>
                  )}
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
                  {entry.colorName && (
                    <div 
                      className="history-color-name"
                      style={{
                        fontSize: '12px',
                        opacity: 0.6,
                        color: entry.averageColor ? getContrastColor(
                          `rgb(${entry.averageColor.r}, ${entry.averageColor.g}, ${entry.averageColor.b})`
                        ) : '#000000',
                        textAlign: 'center',
                        marginTop: '4px',
                        fontStyle: 'italic'
                      }}
                    >
                      "{entry.colorName}"
                    </div>
                  )}
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
                <div style={{ margin: '30px 0', padding: '20px', backgroundColor: '#f0f8ff', borderRadius: '8px', border: '2px solid #e1f5fe' }}>
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
                After voting, you can check out the "Community Blend" to see the average color of all votes for that day's word, as well as the "Most Popular" color voted for that day.
              </p>

              <br />

              <p>
                To keep voting fair while maintaining a frictionless experience, we use <strong>browser fingerprinting</strong> to ensure each device can vote only once per word. This creates a low-friction, cooperative experience with no sign-in required - just you, the word, and your color choice. While determined users could potentially work around this system, my hope is that users will vote with integrity!
              </p>

              <br />
              <p>
                Words are created using <strong>Markov chains</strong> - an algorithm that learns patterns from classic literature, song lyrics, and other texts to generate new, unique words that sound naturally interesting.
              </p>

              <br />
              
              <p>
                Visit the History tab to see how colors have evolved over time - each word gets its own blended color timeline entry.
              </p>

              <br />
              
              <p>
                Color names are provided by{' '}
                <a 
                  href="https://www.thecolorapi.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#1976d2', textDecoration: 'underline' }}
                >
                  The Color API
                </a>
                , which translates RGB values into natural language color names like "Deep Ocean Blue" or "Forest Green."
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
