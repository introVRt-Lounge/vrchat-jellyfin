import React, { useEffect, useState } from 'react';
import { Button, Card, CardBody, Input } from '@heroui/react';

interface LookupHit {
  tmdbId: number;
  title: string;
  year: number | null;
  posterUrl: string | null;
  alreadyAvailable: boolean;
}

interface MovieRequestPanelProps {
  /** Prefill from library search; user can edit before lookup. */
  seedQuery?: string;
  /** Emphasize when library search returned nothing useful. */
  emphasize?: boolean;
}

type Phase = 'idle' | 'looking' | 'pick' | 'submitting' | 'done' | 'error';

function MovieRequestPanel({ seedQuery = '', emphasize = false }: MovieRequestPanelProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [titleQuery, setTitleQuery] = useState(seedQuery);
  const [hits, setHits] = useState<LookupHit[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Keep idle field in sync with library search while the user has not started a flow.
    if (phase === 'idle') {
      setTitleQuery(seedQuery);
    }
  }, [seedQuery, phase]);

  const startLookup = async () => {
    const q = titleQuery.trim();
    if (q.length < 2) {
      setError('Type at least two characters of a movie title.');
      setPhase('error');
      return;
    }
    setPhase('looking');
    setError(null);
    setMessage(null);
    setHits([]);
    try {
      const res = await fetch(`/api/movie-requests/lookup?q=${encodeURIComponent(q)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Lookup failed');
      }
      const results = Array.isArray(data.results) ? (data.results as LookupHit[]) : [];
      if (results.length === 0) {
        setError('No matching titles found to request.');
        setPhase('error');
        return;
      }
      setHits(results);
      setPhase('pick');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lookup failed');
      setPhase('error');
    }
  };

  const submit = async (hit: LookupHit) => {
    setPhase('submitting');
    setError(null);
    try {
      const res = await fetch('/api/movie-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tmdbId: hit.tmdbId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Request failed');
      }
      setMessage(
        data.message ||
          "Got it — we'll try to add that. You'll get a ping when it's ready.",
      );
      setPhase('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
      setPhase('error');
    }
  };

  const reset = () => {
    setPhase('idle');
    setError(null);
    setMessage(null);
    setHits([]);
    setTitleQuery(seedQuery);
  };

  return (
    <div
      className={`mt-4 max-w-xl text-left ${emphasize ? 'rounded-lg border border-primary/40 bg-primary/5 p-3' : ''}`}
    >
      {phase === 'idle' && (
        <div className="space-y-3">
          <p className="text-sm text-gray-400">
            {emphasize
              ? 'Nothing useful in the library for that search? Request the title you want.'
              : "Can't find the right movie? Request it — even if search showed something else."}
          </p>
          <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-end">
            <Input
              type="text"
              label="Movie title"
              aria-label="Movie title to request"
              placeholder="e.g. Dune Part Two"
              value={titleQuery}
              onChange={(e) => setTitleQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void startLookup();
              }}
              className="flex-1"
            />
            <Button color="primary" onPress={() => void startLookup()}>
              Request a movie
            </Button>
          </div>
        </div>
      )}

      {phase === 'looking' && (
        <p className="text-center text-gray-400">Looking up titles…</p>
      )}

      {phase === 'pick' && (
        <div className="space-y-3">
          <p className="text-sm text-gray-300">
            Is this the one? Pick a title — we will queue it without extra details.
          </p>
          <div className="grid gap-3">
            {hits.map((hit) => (
              <Card key={hit.tmdbId} className="bg-gray-800">
                <CardBody className="flex flex-row gap-3 items-center p-3">
                  <div className="w-14 h-20 bg-gray-700 rounded overflow-hidden shrink-0">
                    {hit.posterUrl ? (
                      <img
                        src={hit.posterUrl}
                        alt=""
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : null}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {hit.title}
                      {hit.year ? ` (${hit.year})` : ''}
                    </p>
                    {hit.alreadyAvailable && (
                      <p className="text-xs text-amber-300 mt-1">May already be available</p>
                    )}
                  </div>
                  <Button color="primary" size="sm" onPress={() => void submit(hit)}>
                    Request
                  </Button>
                </CardBody>
              </Card>
            ))}
          </div>
          <div className="text-center">
            <Button variant="ghost" onPress={reset}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {phase === 'submitting' && (
        <p className="text-center text-gray-400">Sending request…</p>
      )}

      {phase === 'done' && message && (
        <div className="space-y-3 text-center">
          <p className="text-emerald-300" role="status">
            {message}
          </p>
          <Button variant="ghost" size="sm" onPress={reset}>
            Request another
          </Button>
        </div>
      )}

      {phase === 'error' && error && (
        <div className="text-center space-y-3">
          <p className="text-red-400" role="alert">
            {error}
          </p>
          <Button variant="ghost" onPress={reset}>
            Try again
          </Button>
        </div>
      )}
    </div>
  );
}

export default MovieRequestPanel;
