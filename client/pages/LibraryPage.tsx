import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Input, Card, CardBody, Button } from '@heroui/react';
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';
import SubtitleModal from '../components/SubtitleModal';
import MovieRequestPanel from '../components/MovieRequestPanel';
import { fetchUiConfig } from '../uiConfig';
import { resolveLibraryItemAction } from '../../src/jellyfin/browseNav';
import { filterCatalogByQuery } from '../../src/jellyfin/catalogSearch';

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

const PAGE_SIZE = 50;
/** Top-level Movies (~4.5k) / Shows (~330) fit one request; search filters locally. */
const CATALOG_LIMIT = 10000;

function LibraryPage() {
  const { libraryId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const navState = (location.state || {}) as { libraryType?: string; libraryName?: string };

  const [catalog, setCatalog] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [libraryType, setLibraryType] = useState<'Movies' | 'TvShows' | null>(null);
  const [subtitleModalOpen, setSubtitleModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<LibraryItem | null>(null);
  const [movieRequestsEnabled, setMovieRequestsEnabled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchUiConfig().then((cfg) => {
      if (!cancelled) setMovieRequestsEnabled(Boolean(cfg.movieRequestsEnabled));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const resolveLibraryType = (rows: LibraryItem[], hinted?: string) => {
    const hint = (hinted || '').toLowerCase();
    if (hint === 'tvshows') return 'TvShows';
    if (hint === 'movies') return 'Movies';
    if (rows.some((r) => r.type === 'Series')) return 'TvShows';
    return 'Movies';
  };

  useEffect(() => {
    if (!libraryId) return;
    let cancelled = false;

    const loadCatalog = async () => {
      setLoading(true);
      setError(null);
      setSearchQuery('');
      setVisibleCount(PAGE_SIZE);
      setCatalog([]);

      try {
        const params = new URLSearchParams();
        params.set('limit', String(CATALOG_LIMIT));
        params.set('offset', '0');
        const response = await fetch(`/libraries/${libraryId}/items?${params}`);
        if (!response.ok) {
          throw new Error(`Failed to fetch items: ${response.status}`);
        }
        const data: LibraryItem[] = await response.json();
        if (cancelled) return;
        setCatalog(data);
        setLibraryType(resolveLibraryType(data, navState.libraryType));
      } catch (err) {
        console.error('Error fetching library items:', err);
        if (!cancelled) {
          setError('Failed to load library items. Please try again later.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadCatalog();
    return () => {
      cancelled = true;
    };
  }, [libraryId, navState.libraryType]);

  useEffect(() => {
    // New query → show first page of matches immediately (local filter).
    setVisibleCount(PAGE_SIZE);
  }, [searchQuery]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        const el = document.querySelector<HTMLInputElement>('input[aria-label="Search library"]');
        el?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const filtered = useMemo(
    () => filterCatalogByQuery(catalog, searchQuery),
    [catalog, searchQuery],
  );
  const items = filtered.slice(0, visibleCount);
  const hasMore = filtered.length > visibleCount;
  const isSearching = false; // local filter is sync

  const handleLoadMore = () => {
    setVisibleCount((n) => n + PAGE_SIZE);
  };

  const handleItemClick = (item: LibraryItem) => {
    const next = resolveLibraryItemAction(item);
    if (next.action === 'show') {
      navigate(`/tvshow/${next.showId}`);
      return;
    }
    if (next.action === 'season') {
      navigate(`/season/${next.seasonId}`);
      return;
    }
    setSelectedItem(item);
    setSubtitleModalOpen(true);
  };

  const clearSearch = () => {
    setSearchQuery('');
  };

  const getSearchStatusText = () => {
    if (searchQuery.trim()) {
      return `Showing ${items.length} of ${filtered.length} ${
        filtered.length === 1 ? 'result' : 'results'
      } — press Esc or clear to reset`;
    }
    return `Tip: press / to focus search · ${catalog.length} titles loaded`;
  };

  const title =
    navState.libraryName ||
    (libraryType === 'Movies' ? 'Movies' : libraryType === 'TvShows' ? 'TV Shows' : 'Library');

  if (loading) {
    return (
      <div className="p-4 sm:p-8 max-w-7xl mx-auto">
        <h1 className="text-2xl sm:text-3xl font-bold mb-8">{title}</h1>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
          {Array.from({ length: 20 }, (_, i) => (
            <Card key={i} className="bg-gray-800 animate-pulse">
              <CardBody className="p-0">
                <div className="aspect-[2/3] bg-gray-700" />
              </CardBody>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error && catalog.length === 0) {
    return (
      <div className="p-4 sm:p-8 max-w-7xl mx-auto">
        <h1 className="text-2xl sm:text-3xl font-bold mb-8">{title}</h1>
        <div className="text-red-400 text-center" role="alert">
          <p>{error}</p>
          <Button className="mt-4" color="primary" onPress={() => window.location.reload()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto">
      <div className="mb-6 sm:mb-8">
        <Button variant="ghost" className="mb-4" onPress={() => navigate('/')}>
          ← Libraries
        </Button>
        <h1 className="text-2xl sm:text-3xl font-bold mb-4">{title}</h1>

        <div className="max-w-md mb-2">
          <Input
            type="search"
            aria-label="Search library"
            placeholder={`Search ${libraryType === 'Movies' ? 'movies' : 'TV shows'}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') clearSearch();
            }}
            startContent={<MagnifyingGlassIcon className="w-4 h-4" />}
            endContent={
              searchQuery ? (
                <Button
                  isIconOnly
                  variant="light"
                  size="sm"
                  aria-label="Clear search"
                  onPress={clearSearch}
                  className="text-gray-400 hover:text-white"
                >
                  <XMarkIcon className="w-4 h-4" />
                </Button>
              ) : null
            }
          />
          <p className="text-sm text-gray-400 mt-2">{getSearchStatusText()}</p>
          {error && (
            <p className="text-sm text-red-400 mt-1" role="alert">
              {error}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
        {items.map((item) => (
          <Card
            key={item.itemId}
            isPressable
            className="bg-gray-800 hover:bg-gray-700 transition-colors group"
            onPress={() => handleItemClick(item)}
          >
            <CardBody className="p-0">
              <div className="aspect-[2/3] bg-gray-700 rounded-t-lg overflow-hidden relative">
                {item.thumbnailUrl ? (
                  <img
                    src={item.thumbnailUrl}
                    alt={item.name || 'Item'}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    loading="lazy"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-500 text-sm">
                    No Image
                  </div>
                )}

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

      {items.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-400 mb-4">
            {searchQuery
              ? `No items found for "${searchQuery}"`
              : 'This library is empty.'}
          </p>
          {searchQuery && (
            <Button onPress={clearSearch} variant="ghost">
              Clear search
            </Button>
          )}
        </div>
      )}

      {hasMore && items.length > 0 && (
        <div className="flex justify-center mt-8">
          <Button color="primary" onPress={handleLoadMore}>
            Load more
          </Button>
        </div>
      )}

      {movieRequestsEnabled &&
        libraryType !== 'TvShows' &&
        searchQuery.trim() &&
        !isSearching && (
          <div className="mt-10 pt-8 border-t border-gray-800 max-w-xl mx-auto">
            <MovieRequestPanel
              seedQuery={searchQuery}
              emphasize={items.length === 0}
            />
          </div>
        )}

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

export default LibraryPage;
