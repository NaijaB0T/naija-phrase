import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Clock, ExternalLink } from 'lucide-react';

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

export function PhraseSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isTyping, setIsTyping] = useState(false);

  const debounceSearch = useCallback(
    debounce(async (searchQuery: string) => {
      // Start searching with just 2 characters for better UX
      if (!searchQuery.trim() || searchQuery.trim().length < 2) {
        setResults([]);
        setLoading(false);
        return;
      }
      
      setLoading(true);
      setError(null);
      
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
        if (!response.ok) {
          throw new Error(`Search failed: ${response.status}`);
        }
        const data = await response.json();
        
        // Handle both success and fallback responses
        if (data.fallback) {
          console.log('Using fallback search results');
        }
        
        setResults(data.results || []);
      } catch (err) {
        console.error('Search error:', err);
        setError('Search temporarily unavailable. Please try again.');
        setResults([]);
      } finally {
        setLoading(false);
        setIsTyping(false);
      }
    }, 200), // Reduced debounce from 300ms to 200ms for faster response
    []
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    setIsTyping(true);
    
    // If user clears the search, immediately clear results
    if (!value.trim()) {
      setResults([]);
      setLoading(false);
      setError(null);
      setIsTyping(false);
    }
    // Start searching earlier for better UX
    else if (value.trim().length >= 2) {
      setIsTyping(true);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Handle Escape key to clear search
    if (e.key === 'Escape') {
      setQuery('');
      setResults([]);
      setError(null);
      setIsTyping(false);
      if (inputRef.current) {
        inputRef.current.blur();
      }
    }
  };

  useEffect(() => {
    // Search with 2+ characters instead of requiring full words
    if (query.trim().length >= 2) {
      debounceSearch(query);
    } else if (query.trim().length === 0) {
      setResults([]);
      setError(null);
      setLoading(false);
      setIsTyping(false);
    }
  }, [query, debounceSearch]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleResultClick = (result: SearchResult) => {
    const youtubeUrl = `https://www.youtube.com/watch?v=${result.youtube_video_id}&t=${Math.floor(result.start_time_seconds)}s`;
    window.open(youtubeUrl, '_blank');
  };

  return (
    <div className="w-full space-y-4">
      <Input
        ref={inputRef}
        type="text"
        placeholder="Search for any words or phrases... (e.g., 'be there', 'I will', 'how to')"
        value={query}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        className="w-full text-lg py-3"
        disabled={loading && !isTyping}
        autoComplete="off"
        autoFocus
      />
      
      {query.trim() && (
        <div className="text-xs text-muted-foreground text-right">
          Press Escape to clear search
        </div>
      )}

      {(loading || isTyping) && query.trim() && (
        <div className="text-center py-4">
          <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
          <p className="text-sm text-muted-foreground mt-2">
            {isTyping ? 'Typing...' : 'Searching...'}
          </p>
        </div>
      )}

      {error && (
        <div className="text-center py-4">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {query.trim() && query.trim().length >= 2 && results.length === 0 && !loading && !error && !isTyping && (
        <div className="text-center py-8">
          <p className="text-muted-foreground">No results found for "{query}"</p>
          <p className="text-sm text-muted-foreground mt-1">
            Try different words or check back later for new content.
          </p>
        </div>
      )}

      {query.trim() && query.trim().length === 1 && !loading && (
        <div className="text-center py-4">
          <p className="text-sm text-muted-foreground">
            Type at least 2 characters to search...
          </p>
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Found {results.length} result{results.length !== 1 ? 's' : ''}
          </p>
          {results.map((result) => (
            <div
              key={result.id}
              onClick={() => handleResultClick(result)}
              className="border rounded-lg p-4 hover:bg-muted cursor-pointer transition-colors group"
            >
              <div className="flex gap-4">
                <img
                  src={result.video_thumbnail}
                  alt={result.video_title}
                  className="w-24 h-18 object-cover rounded flex-shrink-0"
                  loading="lazy"
                />
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-sm group-hover:text-blue-600 transition-colors line-clamp-2">
                    {result.video_title}
                  </h3>
                  {result.channel_title && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {result.channel_title}
                    </p>
                  )}
                  <div className="mt-2 p-2 bg-muted/50 rounded text-sm">
                    <p className="line-clamp-2">"{result.phrase_text}"</p>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      at {formatTime(result.start_time_seconds)}
                    </span>
                    <ExternalLink className="h-3 w-3 text-muted-foreground ml-auto" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}