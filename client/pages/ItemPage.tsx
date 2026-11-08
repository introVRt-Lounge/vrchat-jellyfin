import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@heroui/react';
import SubtitleModal from '../components/SubtitleModal';
import { resolveItemDeeplink } from '../../src/jellyfin/itemDeeplink';

type Details = {
  itemId: string;
  name: string | null;
  type: string;
  subtitles?: Array<{ index: number; language: string }>;
};

function ItemPage() {
  const { itemId } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [mintOpen, setMintOpen] = useState(false);
  const [mintItem, setMintItem] = useState<{ id: string; name: string; subtitles: Details['subtitles'] } | null>(
    null,
  );

  useEffect(() => {
    if (!itemId) return;
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError(null);
      setMintOpen(false);
      setMintItem(null);
      try {
        const res = await fetch(`/items/${itemId}/details`);
        if (res.status === 404) {
          throw new Error('Item not found in Jellyfin');
        }
        if (!res.ok) {
          throw new Error(`Failed to load item: ${res.status}`);
        }
        const details: Details = await res.json();
        if (cancelled) return;

        const next = resolveItemDeeplink({
          itemId: details.itemId || itemId,
          name: details.name,
          type: details.type,
        });

        if (next.action === 'show') {
          navigate(`/tvshow/${next.showId}`, { replace: true });
          return;
        }
        if (next.action === 'season') {
          navigate(`/season/${next.seasonId}`, { replace: true });
          return;
        }
        if (next.action === 'unsupported') {
          setError(`Cannot mint a ${next.type} from this link.`);
          setLoading(false);
          return;
        }

        setMintItem({
          id: next.itemId,
          name: next.itemName,
          subtitles: details.subtitles || [],
        });
        setMintOpen(true);
        setLoading(false);
      } catch (err) {
        console.error('Item deeplink failed:', err);
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load item');
          setLoading(false);
        }
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [itemId, navigate]);

  const handleCloseMint = () => {
    setMintOpen(false);
    navigate('/', { replace: true });
  };

  return (
    <div className="p-4 sm:p-8 max-w-3xl mx-auto">
      <Button variant="ghost" className="mb-4" onPress={() => navigate('/')}>
        ← Libraries
      </Button>
      <h1 className="text-2xl sm:text-3xl font-bold mb-2">Share for VRChat</h1>
      <p className="text-gray-400 mb-8">
        {loading
          ? 'Loading item…'
          : mintItem
            ? `Mint a stream URL for “${mintItem.name}”.`
            : 'Deep link from Jellyfin.'}
      </p>

      {error && (
        <div className="text-red-400 mb-6" role="alert">
          <p>{error}</p>
          <Button className="mt-4" color="primary" onPress={() => navigate('/')}>
            Back to libraries
          </Button>
        </div>
      )}

      {mintItem && (
        <SubtitleModal
          isOpen={mintOpen}
          onClose={handleCloseMint}
          itemId={mintItem.id}
          itemName={mintItem.name}
          subtitles={mintItem.subtitles || []}
        />
      )}
    </div>
  );
}

export default ItemPage;
