import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Search, ChevronLeft, ChevronRight, Play, Pause, Volume2, VolumeX, ExternalLink, Clock } from 'lucide-react';

interface SearchResult {
  id: number;
  video_id: number;
  youtube_video_id: string;
  video_title: string;
  video_thumbnail: string;
  phrase_text: string;
  start_time_seconds: number;
  channel_title?: string;
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

export function HeroSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [showControls, setShowControls] = useState(true);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const playerRef = useRef<any>(null);
  const hideControlsTimeout = useRef<NodeJS.Timeout>();

  // Enhanced search with letter-by-letter matching
  const performSearch = useCallback(
    debounce(async (searchQuery: string) => {
      if (!searchQuery.trim() || searchQuery.trim().length < 1) {
        setResults([]);
        setLoading(false);
        setCurrentIndex(0);
        return;
      }
      
      setLoading(true);
      setError(null);
      
      try {
        // Add limit parameter to prevent performance issues
        const response = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}&limit=1000`);
        if (!response.ok) {
          throw new Error(`Search failed: ${response.status}`);
        }
        const data = await response.json();
        
        const searchResults = data.results || [];
        setResults(searchResults);
        setCurrentIndex(0); // Reset to first result
        
        // Auto-focus first result if we have results
        if (searchResults.length > 0) {
          setIsPlaying(true);
        }
        
      } catch (err) {
        console.error('Search error:', err);
        setError('Search temporarily unavailable. Please try again.');
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 150), // Very fast response for letter-by-letter
    []
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    performSearch(value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setQuery('');
      setResults([]);
      setError(null);
      setCurrentIndex(0);
      if (inputRef.current) {
        inputRef.current.blur();
      }
    } else if (e.key === 'ArrowLeft' && results.length > 0) {
      e.preventDefault();
      navigatePrevious();
    } else if (e.key === 'ArrowRight' && results.length > 0) {
      e.preventDefault();
      navigateNext();
    } else if (e.key === 'Enter' && results.length > 0) {
      e.preventDefault();
      openCurrentInYouTube();
    }
  };

  const navigateNext = () => {
    if (results.length > 0) {
      setCurrentIndex((prev) => (prev + 1) % results.length);
    }
  };

  const navigatePrevious = () => {
    if (results.length > 0) {
      setCurrentIndex((prev) => (prev - 1 + results.length) % results.length);
    }
  };

  const selectResult = (index: number) => {
    setCurrentIndex(index);
    setIsPlaying(true);
  };

  const togglePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  const openCurrentInYouTube = () => {
    if (results[currentIndex]) {
      const result = results[currentIndex];
      const youtubeUrl = `https://www.youtube.com/watch?v=${result.youtube_video_id}&t=${Math.floor(result.start_time_seconds)}s`;
      window.open(youtubeUrl, '_blank');
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Show/hide controls on mouse movement
  const handleMouseMove = () => {
    setShowControls(true);
    if (hideControlsTimeout.current) {
      clearTimeout(hideControlsTimeout.current);
    }
    hideControlsTimeout.current = setTimeout(() => {
      setShowControls(false);
    }, 3000);
  };

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement !== inputRef.current) {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          navigatePrevious();
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          navigateNext();
        } else if (e.key === ' ') {
          e.preventDefault();
          togglePlayPause();
        } else if (e.key === 'm' || e.key === 'M') {
          e.preventDefault();
          toggleMute();
        } else if (e.key === '/') {
          e.preventDefault();
          if (inputRef.current) {
            inputRef.current.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      document.removeEventListener('keydown', handleGlobalKeyDown);
      if (hideControlsTimeout.current) {
        clearTimeout(hideControlsTimeout.current);
      }
    };
  }, [results]);

  const currentResult = results[currentIndex];

  return (
    <div 
      className="relative h-screen w-full overflow-hidden bg-black"
      onMouseMove={handleMouseMove}
    >
      {/* Hero Video Background */}
      <div className="absolute inset-0">
        {currentResult ? (
          <div className="relative w-full h-full">
            <iframe
              className="w-full h-full object-cover"
              src={`https://www.youtube.com/embed/${currentResult.youtube_video_id}?autoplay=${isPlaying ? 1 : 0}&mute=${isMuted ? 0 : 0}&start=${Math.floor(currentResult.start_time_seconds)}&controls=0&showinfo=0&rel=0&modestbranding=0&loop=1&playlist=${currentResult.youtube_video_id}`}
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              ref={playerRef}
            />
            {/* Dark overlay for better text readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/40" />
          </div>
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-blue-900 via-purple-900 to-red-900 flex items-center justify-center">
            <div className="text-center text-white">
              <h1 className="text-6xl font-bold mb-4">Naija Phrase</h1>
              <p className="text-xl opacity-80">Search to discover amazing moments</p>
            </div>
          </div>
        )}
      </div>

      {/* Current Video Title Overlay (Top Left) */}
      {currentResult && (
        <div className={`absolute top-8 left-8 max-w-2xl z-30 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2 drop-shadow-2xl">
            "{currentResult.phrase_text}"
          </h1>
          <h2 className="text-lg md:text-xl text-white/90 mb-2 drop-shadow-lg">
            {currentResult.video_title}
          </h2>
          <p className="text-sm text-white/80 drop-shadow-lg">
            {currentResult.channel_title} • {formatTime(currentResult.start_time_seconds)}
          </p>
        </div>
      )}

      {/* Navigation Controls (Center) */}
      {results.length > 0 && (
        <div className={`absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 flex items-center gap-8 z-30 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
          <button
            onClick={navigatePrevious}
            className="bg-black/50 hover:bg-black/70 text-white p-4 rounded-full backdrop-blur-sm transition-colors"
            disabled={results.length <= 1}
          >
            <ChevronLeft className="h-8 w-8" />
          </button>
          
          <div className="flex items-center gap-4">
            <button
              onClick={togglePlayPause}
              className="bg-black/50 hover:bg-black/70 text-white p-4 rounded-full backdrop-blur-sm transition-colors"
            >
              {isPlaying ? <Pause className="h-8 w-8" /> : <Play className="h-8 w-8" />}
            </button>
            
            <button
              onClick={toggleMute}
              className="bg-black/50 hover:bg-black/70 text-white p-3 rounded-full backdrop-blur-sm transition-colors"
            >
              {isMuted ? <VolumeX className="h-6 w-6" /> : <Volume2 className="h-6 w-6" />}
            </button>
            
            <button
              onClick={openCurrentInYouTube}
              className="bg-red-600/80 hover:bg-red-600 text-white p-3 rounded-full backdrop-blur-sm transition-colors"
            >
              <ExternalLink className="h-6 w-6" />
            </button>
          </div>
          
          <button
            onClick={navigateNext}
            className="bg-black/50 hover:bg-black/70 text-white p-4 rounded-full backdrop-blur-sm transition-colors"
            disabled={results.length <= 1}
          >
            <ChevronRight className="h-8 w-8" />
          </button>
        </div>
      )}

      {/* Progress Indicator */}
      {results.length > 0 && (
        <div className={`absolute bottom-32 left-1/2 transform -translate-x-1/2 z-30 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
          <div className="bg-black/50 backdrop-blur-sm rounded-full px-4 py-2 text-white text-sm">
            {currentIndex + 1} of {results.length}
          </div>
        </div>
      )}

      {/* Search Box (Fixed Bottom) */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 w-full max-w-2xl px-8 z-40">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-6 w-6 text-white/60" />
          <Input
            ref={inputRef}
            type="text"
            placeholder="Search for any phrase... (Type anything, use arrows ←→, press Enter to open)"
            value={query}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            className="w-full text-lg py-4 pl-12 pr-4 bg-black/50 backdrop-blur-md border-white/20 text-white placeholder:text-white/60 focus:border-white/40 focus:ring-white/20"
            autoComplete="off"
          />
          {loading && (
            <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
              <div className="animate-spin h-5 w-5 border-2 border-white/30 border-t-white rounded-full"></div>
            </div>
          )}
        </div>
        
        {query.trim() && (
          <div className="text-center mt-2 text-white/60 text-sm">
            Press Escape to clear • Use ←→ arrows to navigate • Space to play/pause • M to mute
          </div>
        )}
      </div>

      {/* Results Sidebar (Right) */}
      {results.length > 0 && (
        <div className={`absolute top-0 right-0 h-full w-96 bg-black/80 backdrop-blur-md border-l border-white/10 z-20 transition-transform duration-300 ${showControls ? 'translate-x-0' : 'translate-x-full'}`}>
          <div className="p-6 h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold text-lg">
                Search Results ({results.length})
              </h3>
              {results.length >= 1000 && (
                <span className="text-yellow-400 text-xs">Limited to 1000</span>
              )}
            </div>
            
            <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-track-white/10 scrollbar-thumb-white/30">
              <div className="space-y-2">
                {results.map((result, index) => (
                  <div
                    key={result.id}
                    onClick={() => selectResult(index)}
                    className={`cursor-pointer p-3 rounded-lg transition-colors ${
                      index === currentIndex 
                        ? 'bg-white/20 border border-white/30' 
                        : 'bg-white/5 hover:bg-white/10 border border-transparent'
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
                        <p className="text-white/70 text-xs mb-1">
                          {result.channel_title}
                        </p>
                        <div className="bg-white/10 rounded px-2 py-1 mb-1">
                          <p className="text-white text-xs line-clamp-2">
                            "{result.phrase_text}"
                          </p>
                        </div>
                        <div className="flex items-center gap-1 text-white/50 text-xs">
                          <Clock className="h-3 w-3" />
                          {formatTime(result.start_time_seconds)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="absolute bottom-24 left-1/2 transform -translate-x-1/2 z-40">
          <div className="bg-red-500/80 backdrop-blur-sm text-white px-4 py-2 rounded-lg">
            {error}
          </div>
        </div>
      )}

      {/* No Results Message */}
      {query.trim() && results.length === 0 && !loading && !error && (
        <div className="absolute bottom-24 left-1/2 transform -translate-x-1/2 z-40">
          <div className="bg-black/50 backdrop-blur-sm text-white/80 px-4 py-2 rounded-lg text-center">
            No results found for "{query}"
          </div>
        </div>
      )}

      {/* Keyboard Shortcuts Help (Top Right) */}
      <div className={`absolute top-8 right-8 z-30 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
        <div className="bg-black/30 backdrop-blur-sm rounded-lg p-4 text-white/70 text-xs">
          <div className="font-semibold mb-2">Keyboard Shortcuts:</div>
          <div>/ - Focus search</div>
          <div>←→ - Navigate results</div>
          <div>Space - Play/Pause</div>
          <div>M - Mute/Unmute</div>
          <div>Enter - Open in YouTube</div>
          <div>Esc - Clear search</div>
        </div>
      </div>
    </div>
  );
}
