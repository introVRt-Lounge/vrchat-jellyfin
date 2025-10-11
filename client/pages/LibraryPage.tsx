import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Input, Card, CardBody, CardHeader, Button } from '@heroui/react';
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';
import SubtitleModal from '../components/SubtitleModal';

interface LibraryItem {
  itemId: string;
  name: string | null;
  type: string;
  thumbnailUrl: string | null;
  hasSubtitles: boolean;
  subtitles: Array<{
    index: number;
    language: string;
  }>;
}

function LibraryPage() {
  const { libraryId } = useParams();
  const navigate = useNavigate();
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [libraryType, setLibraryType] = useState<'Movies' | 'TvShows' | null>(null);
  const [subtitleModalOpen, setSubtitleModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<LibraryItem | null>(null);

  // Debounced search function
  const debouncedSearch = useCallback(
    debounce(async (query: string) => {
      setIsSearching(true);
      try {
        const params = new URLSearchParams();
        if (query.trim()) {
          params.append('search', query.trim());
        }

        const response = await fetch(`/libraries/${libraryId}/items?${params}`);
        if (!response.ok) {
          throw new Error(`Failed to fetch items: ${response.status}`);
        }
        const data = await response.json();
        setFilteredItems(data);
      } catch (err) {
        console.error('Error searching items:', err);
        setError('Failed to search items');
      } finally {
        setIsSearching(false);
      }
    }, 300),
    [libraryId]
  );

  useEffect(() => {
    const fetchInitialItems = async () => {
      if (!libraryId) return;

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/libraries/${libraryId}/items`);
        if (!response.ok) {
          throw new Error(`Failed to fetch library items: ${response.status}`);
        }
        const data = await response.json();
        setItems(data);
        setFilteredItems(data);

        // Determine library type from first item
        if (data.length > 0) {
          setLibraryType(data[0].type === 'Episode' ? 'TvShows' : 'Movies');
        }
      } catch (err) {
        console.error('Error fetching library items:', err);
        setError('Failed to load library items. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchInitialItems();
  }, [libraryId]);

  useEffect(() => {
    debouncedSearch(searchQuery);
  }, [searchQuery, debouncedSearch]);

  const handleItemClick = (item: LibraryItem) => {
    if (libraryType === 'TvShows') {
      navigate(`/tvshow/${item.itemId}`);
    } else {
      // For movies, go directly to subtitle selection
      handleMovieClick(item);
    }
  };

  const handleMovieClick = async (item: LibraryItem) => {
    setSelectedItem(item);
    setSubtitleModalOpen(true);
  };

  const clearSearch = () => {
    setSearchQuery('');
  };

  const getSearchStatusText = () => {
    if (isSearching) return 'Searching...';
    if (searchQuery.trim()) {
      return `Found ${filteredItems.length} ${filteredItems.length === 1 ? 'item' : 'items'}`;
    }
    return '';
  };

  if (loading) {
    return (
      <div className="p-8">
        <h1 className="text-3xl font-bold mb-8">Library</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {Array.from({ length: 20 }, (_, i) => (
            <Card key={i} className="bg-gray-800 animate-pulse">
              <CardBody className="p-0">
                <div className="aspect-[2/3] bg-gray-700"></div>
              </CardBody>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <h1 className="text-3xl font-bold mb-8">Library</h1>
        <div className="text-red-400 text-center">
          <p>{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-4">
          {libraryType === 'Movies' ? 'Movies' : 'TV Shows'}
        </h1>

        {/* Search Bar */}
        <div className="max-w-md mb-4">
          <Input
            type="text"
            placeholder={`Search ${libraryType === 'Movies' ? 'movies' : 'TV shows'}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            startContent={<MagnifyingGlassIcon className="w-4 h-4" />}
            endContent={
              searchQuery ? (
                <Button
                  isIconOnly
                  variant="light"
                  size="sm"
                  onClick={clearSearch}
                  className="text-gray-400 hover:text-white"
                >
                  <XMarkIcon className="w-4 h-4" />
                </Button>
              ) : null
            }
            className="mb-2"
          />
          {getSearchStatusText() && (
            <p className="text-sm text-gray-400">{getSearchStatusText()}</p>
          )}
        </div>
      </div>

      {/* Items Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {filteredItems.map((item) => (
          <Card
            key={item.itemId}
            className="bg-gray-800 hover:bg-gray-700 transition-colors cursor-pointer group"
            onClick={() => handleItemClick(item)}
          >
            <CardBody className="p-0">
              <div className="aspect-[2/3] bg-gray-700 rounded-t-lg overflow-hidden relative">
                {item.thumbnailUrl ? (
                  <img
                    src={item.thumbnailUrl}
                    alt={item.name || 'Item'}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-500">
                    No Image
                  </div>
                )}

                {/* Subtitle indicator */}
                {item.hasSubtitles && (
                  <div className="absolute top-2 right-2 bg-blue-600 text-white text-xs px-2 py-1 rounded">
                    CC
                  </div>
                )}
              </div>

              <div className="p-3">
                <h3 className="font-medium text-sm line-clamp-2" title={item.name || 'Unnamed'}>
                  {item.name || 'Unnamed'}
                </h3>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      {filteredItems.length === 0 && searchQuery && !isSearching && (
        <div className="text-center py-12">
          <p className="text-gray-400 mb-4">No items found for "{searchQuery}"</p>
          <Button onClick={clearSearch} variant="ghost">
            Clear search
          </Button>
        </div>
      )}

      {/* Subtitle Selection Modal */}
      {selectedItem && (
        <SubtitleModal
          isOpen={subtitleModalOpen}
          onClose={() => setSubtitleModalOpen(false)}
          itemId={selectedItem.itemId}
          itemName={selectedItem.name || 'Unknown'}
          subtitles={selectedItem.subtitles}
        />
      )}
    </div>
  );
}

// Debounce utility function
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export default LibraryPage;
