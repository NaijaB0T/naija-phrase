import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Play, Pause, Trash2 } from 'lucide-react';

interface SearchTerm {
  id: number;
  term_text: string;
  status: string;
  admin_id: number;
  last_discovery_run_at: string | null;
  created_at: string;
  updated_at: string;
  video_count?: number;
  processed_count?: number;
}

interface SearchTermsTableProps {
  searchTerms: SearchTerm[];
  onAddTerm: (term: string) => void;
  onDeleteTerm: (id: number) => void;
  onRunDiscovery: (id: number) => void;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'Active': return 'bg-green-100 text-green-800';
    case 'Pending Discovery': return 'bg-yellow-100 text-yellow-800';
    case 'Discovering Videos': return 'bg-blue-100 text-blue-800';
    case 'Processing Subtitles': return 'bg-purple-100 text-purple-800';
    case 'Error': return 'bg-red-100 text-red-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

export function SearchTermsTable({ 
  searchTerms, 
  onAddTerm, 
  onDeleteTerm, 
  onRunDiscovery 
}: SearchTermsTableProps) {
  const [newTerm, setNewTerm] = useState('');
  const [isAddingTerm, setIsAddingTerm] = useState(false);

  const handleAddTerm = async () => {
    if (!newTerm.trim()) return;
    
    setIsAddingTerm(true);
    try {
      await onAddTerm(newTerm.trim());
      setNewTerm('');
    } finally {
      setIsAddingTerm(false);
    }
  };

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
        </div>
      </div>

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
                          onClick={() => onRunDiscovery(term.id)}
                          disabled={term.status === 'Discovering Videos'}
                        >
                          <Play className="h-3 w-3 mr-1" />
                          Run
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => onDeleteTerm(term.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
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