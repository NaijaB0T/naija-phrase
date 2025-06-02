import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Search, Play, ChevronLeft, ChevronRight, Clock, ExternalLink } from 'lucide-react';

interface SearchResult {
  id: number;
  video_id: number;
  youtube_video_id: string;
  video_title: string;
  video_thumbnail: string;
  phrase_text: string;
  start_time_seconds: number;
  end_time_seconds?: number;
  channel_title?: string;
  published_at: string;
  relevance_score?: number;
}

// Debounce utility function
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

export function VideoHeroSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [showWelcome, setShowWelcome] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  // Welcome video when no search is active
  const welcomeVideo = {
    youtube_video_id: 'dQw4w9WgXcQ', // Default video - you can change this
    video_title: 'Welcome to Naija Phrase',
    phrase_text: 'Search for any phrase in YouTube videos and jump to exact moments',
    start_time_seconds: 0,
    channel_title: 'Naija Phrase'
  };

  const currentVideo = showWelcome ? welcomeVideo : (results[currentVideoIndex] || welcomeVideo);

  const debounceSearch = useCallback(
    debounce(async (searchQuery: string) => {
      if (!searchQuery.trim() || searchQuery.trim().length < 1) {
        setResults([]);
        setLoading(false);
        setShowWelcome(true);
        setCurrentVideoIndex(0);
        return;
      }
      
      setLoading(true);
      setError(null);
      setShowWelcome(false);
      
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
        if (!response.ok) {
          throw new Error(`Search failed: ${response.status}`);
        }
        const data = await response.json();
        
        setResults(data.results || []);
        setCurrentVideoIndex(0); // Reset to first result
        
        if (data.limited) {
          console.log('Results limited to 1000 for performance');
        }
        
      } catch (err) {
        console.error('Search error:', err);
        setError('Search temporarily unavailable. Please try again.');
        setResults([]);
        setShowWelcome(true);
      } finally {
        setLoading(false);
      }
    }, 150), // Very fast response for letter-by-letter matching
    []
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    
    if (!value.trim()) {
      setResults([]);
      setLoading(false);
      setError(null);
      setShowWelcome(true);
      setCurrentVideoIndex(0);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setQuery('');
      setResults([]);
      setError(null);
      setShowWelcome(true);
      setCurrentVideoIndex(0);
      if (inputRef.current) {
        inputRef.current.blur();
      }
    }
    
    // Arrow key navigation through results
    if (results.length > 0) {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setCurrentVideoIndex(prev => prev > 0 ? prev - 1 : results.length - 1);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setCurrentVideoIndex(prev => prev < results.length - 1 ? prev + 1 : 0);
      }
    }
  };

  useEffect(() => {
    if (query.trim().length >= 1) {
      debounceSearch(query);
    }
  }, [query, debounceSearch]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const goToPrevious = () => {
    if (results.length > 0) {
      setCurrentVideoIndex(prev => prev > 0 ? prev - 1 : results.length - 1);
    }
  };

  const goToNext = () => {
    if (results.length > 0) {
      setCurrentVideoIndex(prev => prev < results.length - 1 ? prev + 1 : 0);
    }
  };

  const selectVideo = (index: number) => {
    setCurrentVideoIndex(index);
  };

  const openVideoInYouTube = () => {
    const startTime = Math.floor(currentVideo.start_time_seconds || 0);
    const youtubeUrl = `https://www.youtube.com/watch?v=${currentVideo.youtube_video_id}&t=${startTime}s`;
    window.open(youtubeUrl, '_blank');
  };

  const highlightMatch = (text: string, query: string) => {
    if (!query.trim()) return text;
    
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, index) => 
      regex.test(part) ? 
        <mark key={index} className="bg-yellow-300 text-black px-1 rounded">{part}</mark> : 
        part
    );
  };

  return (
    <div className="relative h-screen w-full bg-black overflow-hidden">
      {/* YouTube Video Background */}
      <div className="absolute inset-0 w-full h-full">
        <iframe
          src={`https://www.youtube.com/embed/${currentVideo.youtube_video_id}?autoplay=1&mute=1&controls=0&showinfo=0&rel=0&iv_load_policy=3&modestbranding=1&playsinline=1&loop=1&playlist=${currentVideo.youtube_video_id}&start=${Math.floor(currentVideo.start_time_seconds || 0)}`}
          className="w-full h-full object-cover"
          allow="autoplay; encrypted-media"
          allowFullScreen
          style={{ 
            minWidth: '100%', 
            minHeight: '100%',
            transform: 'scale(1.05)', // Slight zoom to hide black bars
          }}
        />
        
        {/* Dark overlay for better text readability */}
        <div className="absolute inset-0 bg-black bg-opacity-40" />
      </div>

      {/* Top Left Overlay - Video Info */}
      <div className="absolute top-8 left-8 z-20 max-w-2xl">
        <div className="bg-black bg-opacity-70 rounded-lg p-6 backdrop-blur-sm border border-white/20">
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-4 leading-tight">
            {showWelcome ? (
              <>Find <span className="text-red-500">Exact Moments</span></>
            ) : (
              currentVideo.video_title
            )}
          </h1>
          
          {!showWelcome && (
            <>
              <p className="text-xl text-gray-200 mb-3">
                {highlightMatch(currentVideo.phrase_text, query)}
              </p>
              <div className="flex items-center gap-4 text-sm text-gray-300">
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {formatTime(currentVideo.start_time_seconds)}
                </span>
                <span>{currentVideo.channel_title}</span>
                {results.length > 0 && (
                  <span className="bg-red-600 px-2 py-1 rounded text-white text-xs">
                    {currentVideoIndex + 1} of {results.length}
                  </span>
                )}
              </div>
            </>
          )}
          
          {showWelcome && (
            <p className="text-xl text-gray-200">
              Search for specific phrases and jump directly to the timestamp where they're spoken in YouTube videos.
            </p>
          )}
        </div>
      </div>

      {/* Navigation Arrows */}
      {!showWelcome && results.length > 1 && (
        <>
          <button
            onClick={goToPrevious}
            className="absolute left-4 top-1/2 transform -translate-y-1/2 z-30 bg-black bg-opacity-70 hover:bg-opacity-90 text-white p-3 rounded-full transition-all backdrop-blur-sm border border-white/20"
          >
            <ChevronLeft className="h-8 w-8" />
          </button>
          
          <button
            onClick={goToNext}
            className="absolute right-4 md:right-80 top-1/2 transform -translate-y-1/2 z-30 bg-black bg-opacity-70 hover:bg-opacity-90 text-white p-3 rounded-full transition-all backdrop-blur-sm border border-white/20"
          >
            <ChevronRight className="h-8 w-8" />
          </button>
        </>
      )}

      {/* Right Panel - Search Results List */}
      {!showWelcome && results.length > 0 && (
        <div className="absolute right-0 top-0 h-full w-80 bg-black bg-opacity-90 backdrop-blur-md border-l border-white/20 z-20 overflow-hidden">
          <div className="p-4 border-b border-white/20">
            <h3 className="text-white font-semibold text-lg">Search Results</h3>
            <p className="text-gray-300 text-sm">
              {results.length} result{results.length !== 1 ? 's' : ''} for "{query}"
            </p>
          </div>
          
          <div className="overflow-y-auto h-full pb-32">
            {results.map((result, index) => (
              <div
                key={result.id}
                onClick={() => selectVideo(index)}
                className={`p-4 border-b border-white/10 cursor-pointer transition-all hover:bg-white/10 ${
                  currentVideoIndex === index ? 'bg-red-600/30 border-red-500/50' : ''
                }`}
              >
                <div className="flex gap-3">
                  <img
                    src={result.video_thumbnail}
                    alt={result.video_title}
                    className="w-16 h-12 object-cover rounded flex-shrink-0"
                    loading="lazy"
                  />
                  <div className="flex-1 min-w-0">
                    <h4 className="text-white text-sm font-medium line-clamp-2 mb-1">
                      {result.video_title}
                    </h4>
                    <p className="text-gray-300 text-xs mb-2">
                      {highlightMatch(result.phrase_text, query)}
                    </p>
                    <div className="flex items-center justify-between text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatTime(result.start_time_seconds)}
                      </span>
                      <span className="text-xs opacity-75">
                        #{index + 1}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Fixed Search Box at Bottom */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-30 w-full max-w-2xl px-8">
        <div className="relative">
          <div className="absolute left-4 top-1/2 transform -translate-y-1/2 z-10">
            <Search className="h-6 w-6 text-gray-400" />
          </div>
          
          <Input
            ref={inputRef}
            type="text"
            placeholder="Search for any phrase... (e.g., 'be there', 'I will', 'how to')"
            value={query}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            className="w-full text-lg py-6 pl-14 pr-20 bg-black/70 backdrop-blur-md border-white/30 text-white placeholder-gray-300 focus:border-red-500 focus:ring-red-500/50 rounded-xl"
            autoComplete="off"
            autoFocus
          />
          
          {!showWelcome && (
            <button
              onClick={openVideoInYouTube}
              className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-red-600 hover:bg-red-700 text-white p-2 rounded-lg transition-colors"
              title="Open in YouTube"
            >
              <ExternalLink className="h-5 w-5" />
            </button>
          )}
        </div>
        
        {query.trim() && (
          <div className="text-center mt-2">
            <p className="text-xs text-gray-300">
              Use arrow keys to navigate • Press Escape to clear • {loading ? 'Searching...' : ''}
            </p>
          </div>
        )}
      </div>

      {/* Loading Indicator */}
      {loading && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-30">
          <div className="bg-black bg-opacity-70 rounded-lg p-4 backdrop-blur-sm">
            <div className="animate-spin h-8 w-8 border-3 border-red-600 border-t-transparent rounded-full mx-auto mb-2"></div>
            <p className="text-white text-sm">Searching...</p>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="absolute top-20 right-8 z-30 max-w-sm">
          <div className="bg-red-600 bg-opacity-90 text-white p-4 rounded-lg backdrop-blur-sm">
            <p className="text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* No Results Message */}
      {!showWelcome && !loading && query.trim() && results.length === 0 && !error && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-30">
          <div className="bg-black bg-opacity-70 rounded-lg p-6 backdrop-blur-sm text-center">
            <p className="text-white text-lg mb-2">No results found for "{query}"</p>
            <p className="text-gray-300 text-sm">Try different words or check back later for new content.</p>
          </div>
        </div>
      )}
    </div>
  );
}
