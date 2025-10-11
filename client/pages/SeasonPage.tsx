import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardBody, Button } from '@heroui/react';

interface Episode {
  itemId: string;
  name: string | null;
  index: number | null;
  thumbnailUrl: string | null;
  hasSubtitles: boolean;
  subtitles: Array<{
    index: number;
    language: string;
  }>;
}

function SeasonPage() {
  const { seasonId } = useParams();
  const navigate = useNavigate();
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [seasonName, setSeasonName] = useState<string>('');
  const [showName, setShowName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEpisodes = async () => {
      if (!seasonId) return;

      setLoading(true);
      setError(null);

      try {
        // First get season details
        const seasonResponse = await fetch(`/items/${seasonId}/details`);
        if (!seasonResponse.ok) {
          throw new Error(`Failed to fetch season details: ${seasonResponse.status}`);
        }
        const seasonData = await seasonResponse.json();
        setSeasonName(seasonData.name || `Season ${seasonData.index || 'Unknown'}`);

        // Then get episodes
        const episodesResponse = await fetch(`/seasons/${seasonId}/episodes`);
        if (!episodesResponse.ok) {
          throw new Error(`Failed to fetch episodes: ${episodesResponse.status}`);
        }
        const episodesData = await episodesResponse.json();
        setEpisodes(episodesData);
      } catch (err) {
        console.error('Error fetching episodes:', err);
        setError('Failed to load episodes. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchEpisodes();
  }, [seasonId]);

  const handleEpisodeClick = async (episode: Episode) => {
    // Handle episode selection - same as movie selection
    // This will be implemented when we create the subtitle selection UI
    console.log('Episode clicked:', episode);
  };

  const handleBackClick = () => {
    navigate(-1);
  };

  if (loading) {
    return (
      <div className="p-8">
        <h1 className="text-3xl font-bold mb-8">Loading...</h1>
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
        <div className="mb-4">
          <Button onClick={handleBackClick} variant="ghost" className="mb-4">
            ← Back
          </Button>
          <h1 className="text-3xl font-bold">{seasonName}</h1>
        </div>
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
        <Button onClick={handleBackClick} variant="ghost" className="mb-4">
          ← Back
        </Button>
        <h1 className="text-3xl font-bold mb-2">{seasonName}</h1>
        <p className="text-gray-400">Select an episode</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {episodes.map((episode) => (
          <Card
            key={episode.itemId}
            className="bg-gray-800 hover:bg-gray-700 transition-colors cursor-pointer group"
            onClick={() => handleEpisodeClick(episode)}
          >
            <CardBody className="p-0">
              <div className="aspect-[2/3] bg-gray-700 rounded-t-lg overflow-hidden relative">
                {episode.thumbnailUrl ? (
                  <img
                    src={episode.thumbnailUrl}
                    alt={episode.name || `Episode ${episode.index}`}
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
                {episode.hasSubtitles && (
                  <div className="absolute top-2 right-2 bg-blue-600 text-white text-xs px-2 py-1 rounded">
                    CC
                  </div>
                )}
              </div>

              <div className="p-3">
                <h3 className="font-medium text-sm line-clamp-2" title={episode.name || 'Unnamed'}>
                  {episode.index && `E${episode.index.toString().padStart(2, '0')}: `}
                  {episode.name || 'Unnamed Episode'}
                </h3>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      {episodes.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-400">No episodes found for this season.</p>
        </div>
      )}
    </div>
  );
}

export default SeasonPage;
