import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Play, Trash2, RefreshCw } from 'lucide-react';

interface SearchTerm {
  id: number;
  term_text: string;
  status: string;
  admin_id: number;
  last_discovery_run_at: string | null;
  created_at: string;
  updated_at: string;
  error_message?: string | null;
  video_count?: number;
  processed_count?: number;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'Active': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    case 'Pending Discovery': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    case 'Discovering Videos': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    case 'Processing Subtitles': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
    case 'Error': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
  }
};

export function SearchTermsManager() {
  const [searchTerms, setSearchTerms] = useState<SearchTerm[]>([]);
  const [newTerm, setNewTerm] = useState('');
  const [isAddingTerm, setIsAddingTerm] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSearchTerms = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/admin/search-terms');
      if (!response.ok) throw new Error('Failed to fetch search terms');
      const data = await response.json();
      setSearchTerms(data.searchTerms || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching search terms:', err);
      setError('Failed to load search terms');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSearchTerms();
  }, []);

  const handleAddTerm = async () => {
    if (!newTerm.trim()) return;
    
    setIsAddingTerm(true);
    try {
      const response = await fetch('/api/admin/search-terms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ term: newTerm.trim() })
      });
      
      if (!response.ok) throw new Error('Failed to add search term');
      
      setNewTerm('');
      await fetchSearchTerms(); // Refresh the list
    } catch (err) {
      console.error('Error adding search term:', err);
      setError('Failed to add search term');
    } finally {
      setIsAddingTerm(false);
    }
  };

  const handleDeleteTerm = async (id: number) => {
    if (!confirm('Are you sure you want to delete this search term?')) return;
    
    try {
      const response = await fetch('/api/admin/search-terms', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      
      if (!response.ok) throw new Error('Failed to delete search term');
      
      await fetchSearchTerms(); // Refresh the list
    } catch (err) {
      console.error('Error deleting search term:', err);
      setError('Failed to delete search term');
    }
  };

  const handleRunDiscovery = async (id: number) => {
    try {
      const response = await fetch('/api/admin/run-discovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ searchTermId: id })
      });
      
      if (!response.ok) throw new Error('Failed to trigger discovery');
      
      await fetchSearchTerms(); // Refresh to show updated status
    } catch (err) {
      console.error('Error triggering discovery:', err);
      setError('Failed to trigger discovery');
    }
  };

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">Loading search terms...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Search Terms</h2>
        <div className="flex gap-2">
          <Input
            type="text"
            placeholder="Enter new search term..."
            value={newTerm}
            onChange={(e) => setNewTerm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddTerm()}
            className="w-64"
          />
          <Button 
            onClick={handleAddTerm} 
            disabled={isAddingTerm || !newTerm.trim()}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Term
          </Button>
          <Button variant="outline" onClick={fetchSearchTerms}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      <div className="border rounded-lg">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="text-left p-4 font-medium">Term</th>
                <th className="text-left p-4 font-medium">Status</th>
                <th className="text-left p-4 font-medium">Videos</th>
                <th className="text-left p-4 font-medium">Processed</th>
                <th className="text-left p-4 font-medium">Last Run</th>
                <th className="text-left p-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {searchTerms.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center p-8 text-muted-foreground">
                    No search terms added yet. Add your first search term above.
                  </td>
                </tr>
              ) : (
                searchTerms.map((term) => (
                  <tr key={term.id} className="border-b hover:bg-muted/30">
                    <td className="p-4 font-medium">{term.term_text}</td>
                    <td className="p-4">
                      <Badge className={getStatusColor(term.status)}>
                        {term.status}
                      </Badge>
                    </td>
                    <td className="p-4">{term.video_count || 0}</td>
                    <td className="p-4">{term.processed_count || 0}</td>
                    <td className="p-4 text-sm text-muted-foreground">
                      {term.last_discovery_run_at 
                        ? new Date(term.last_discovery_run_at).toLocaleDateString()
                        : 'Never'
                      }
                    </td>
                    <td className="p-4">
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleRunDiscovery(term.id)}
                          disabled={term.status === 'Discovering Videos'}
                        >
                          <Play className="h-3 w-3 mr-1" />
                          Run
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleDeleteTerm(term.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                        {term.status === 'Error' && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => {
                              const errorMsg = term.error_message || 'Unknown error occurred - no details available';
                              alert(`Error Details:\n\n${errorMsg}`);
                            }}
                            className="text-red-600 hover:text-red-700"
                          >
                            Details
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}