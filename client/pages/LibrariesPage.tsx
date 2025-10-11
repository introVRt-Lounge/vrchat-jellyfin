import React, { useEffect, useState } from 'react';
import { Card, CardBody, CardHeader } from '@heroui/react';
import { useNavigate } from 'react-router-dom';

interface Library {
  itemId: string;
  name: string | null;
  type: 'Movies' | 'TvShows' | string;
  thumbnailUrl: string | null;
}

function LibrariesPage() {
  const [libraries, setLibraries] = useState<Library[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchLibraries = async () => {
      try {
        const response = await fetch('/libraries');
        if (!response.ok) {
          throw new Error(`Failed to fetch libraries: ${response.status}`);
        }
        const data = await response.json();
        setLibraries(data);
      } catch (err) {
        console.error('Error fetching libraries:', err);
        setError('Failed to load libraries. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchLibraries();
  }, []);

  const handleLibraryClick = (library: Library) => {
    navigate(`/library/${library.itemId}`);
  };

  if (loading) {
    return (
      <div className="p-8">
        <h1 className="text-3xl font-bold mb-8">VRChat Jellyfin</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="bg-gray-800 animate-pulse">
              <CardHeader>
                <div className="h-6 bg-gray-700 rounded w-3/4"></div>
              </CardHeader>
              <CardBody>
                <div className="h-4 bg-gray-700 rounded w-1/2"></div>
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
        <h1 className="text-3xl font-bold mb-8">VRChat Jellyfin</h1>
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
      <h1 className="text-3xl font-bold mb-8">VRChat Jellyfin</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {libraries.map((library) => (
          <Card
            key={library.itemId}
            className="bg-gray-800 hover:bg-gray-700 transition-colors cursor-pointer"
            onClick={() => handleLibraryClick(library)}
          >
            <CardHeader>
              <h2 className="text-xl font-semibold">{library.name || 'Unnamed Library'}</h2>
            </CardHeader>
            <CardBody>
              <div className="aspect-video bg-gray-700 rounded mb-4 overflow-hidden">
                {library.thumbnailUrl ? (
                  <img
                    src={library.thumbnailUrl}
                    alt={library.name || 'Library'}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      // Hide broken images
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-500">
                    No Image
                  </div>
                )}
              </div>
              <p className="text-gray-300">
                Browse {library.type === 'Movies' ? 'movies' : library.type === 'TvShows' ? 'TV shows' : 'media'}
              </p>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default LibrariesPage;
