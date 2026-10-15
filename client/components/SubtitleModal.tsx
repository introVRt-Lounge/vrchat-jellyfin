import React, { useState, useEffect } from 'react';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Card,
  CardBody,
  RadioGroup,
  Radio,
  Select,
  SelectItem,
} from '@heroui/react';
import { fetchUiConfig, type StreamDurationOption } from '../uiConfig';

interface Subtitle {
  index: number;
  language: string;
}

interface SubtitleModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemId: string;
  itemName: string;
  subtitles: Subtitle[];
}

/** 1–2 people → proxy; 3+ → OCI HLS fan-out. */
type AudienceSize = 'friends' | 'group';

function AudienceFlowDiagram() {
  return (
    <pre
      className="mt-3 overflow-x-auto rounded bg-gray-900/80 p-3 text-[11px] leading-relaxed text-gray-300 font-mono"
      aria-hidden="true"
    >{`Just you + a friend (1–2)
  you ──mint──▶ /v/… proxy ──▶ headset(s)
                 (TTL you pick)

Group (3+)
  you ──mint──▶ bake once ──▶ Object Storage
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
           headset        headset         headset
           (same public playlist URL ~1 day)`}</pre>
  );
}

function SubtitleModal({
  isOpen,
  onClose,
  itemId,
  itemName,
  subtitles: subtitlesProp = [],
}: SubtitleModalProps) {
  const [selectedSubtitleIndex, setSelectedSubtitleIndex] = useState<number | null>(null);
  const [generatedUrl, setGeneratedUrl] = useState<string>('');
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [durations, setDurations] = useState<StreamDurationOption[]>([
    { id: '24h', label: '24 hours', hours: 24, extended: false },
  ]);
  const [ttlHours, setTtlHours] = useState(24);
  const [extendedGated, setExtendedGated] = useState(false);
  const [fanoutEnabled, setFanoutEnabled] = useState(false);
  const [fanoutMaxSeconds, setFanoutMaxSeconds] = useState(120);
  const [audience, setAudience] = useState<AudienceSize>('friends');
  const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
  const [loadingSubtitles, setLoadingSubtitles] = useState(false);

  const useFanout = fanoutEnabled && audience === 'group';

  useEffect(() => {
    if (!isOpen) return;
    setSelectedSubtitleIndex(null);
    setGeneratedUrl('');
    setExpiresAt(null);
    setError(null);
    setCopied(false);
    setAudience('friends');
    setSubtitles(subtitlesProp.length ? subtitlesProp : []);
    let cancelled = false;
    fetchUiConfig().then((cfg) => {
      if (cancelled) return;
      setDurations(cfg.streamUrlDurations);
      setTtlHours(cfg.streamUrlDefaultHours);
      setExtendedGated(cfg.streamUrlExtendedRoleGated);
      setFanoutEnabled(cfg.ociHlsFanoutEnabled);
      setFanoutMaxSeconds(cfg.ociHlsMaxSeconds);
    });
    // List/search no longer ships MediaStreams — load once when minting.
    setLoadingSubtitles(true);
    fetch(`/items/${itemId}/details`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`Failed to load item details: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        const rows = Array.isArray(data?.subtitles) ? data.subtitles : [];
        setSubtitles(
          rows.map((s: Subtitle) => ({
            index: s.index,
            language: s.language || 'Unknown',
          })),
        );
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Error loading subtitles:', err);
        // Keep any prop fallback; still allow "No Subtitles" mint.
      })
      .finally(() => {
        if (!cancelled) setLoadingSubtitles(false);
      });
    return () => {
      cancelled = true;
    };
    // Intentionally omit subtitlesProp — parents pass a fresh [] each render.
  }, [isOpen, itemId]); // eslint-disable-line react-hooks/exhaustive-deps

  const getLanguageFlag = (language: string) => {
    const flagMap: { [key: string]: string } = {
      en: '🇺🇸',
      es: '🇪🇸',
      fr: '🇫🇷',
      de: '🇩🇪',
      it: '🇮🇹',
      pt: '🇵🇹',
      ru: '🇷🇺',
      ja: '🇯🇵',
      ko: '🇰🇷',
      zh: '🇨🇳',
      ar: '🇸🇦',
      hi: '🇮🇳',
    };
    return flagMap[language.toLowerCase()] || '🏳️';
  };

  const handleSubtitleSelect = async (subtitleIndex: number | null) => {
    setLoading(true);
    setError(null);

    try {
      if (useFanout) {
        const response = await fetch(`/i/${itemId}/fanout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            subtitleStreamIndex: subtitleIndex,
          }),
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.error || `Fan-out publish failed: ${response.status}`);
        }

        const url = typeof data.playlistUrl === 'string' ? data.playlistUrl : '';
        if (!url) {
          throw new Error('Fan-out publish returned no playlist URL');
        }

        setGeneratedUrl(url);
        setExpiresAt(null);
        setSelectedSubtitleIndex(subtitleIndex);

        if (navigator.clipboard) {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 3000);
        }
        return;
      }

      const response = await fetch(`/i/${itemId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subtitleStreamIndex: subtitleIndex,
          ttlHours,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || `Failed to create proxy: ${response.status}`);
      }

      const proxyId = data.id;
      const url = `${window.location.origin}/v/${proxyId}`;

      setGeneratedUrl(url);
      setExpiresAt(typeof data.expiresAt === 'string' ? data.expiresAt : null);
      setSelectedSubtitleIndex(subtitleIndex);

      if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
      }
    } catch (err) {
      console.error('Error creating proxy:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to generate streaming URL. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    if (generatedUrl && navigator.clipboard) {
      await navigator.clipboard.writeText(generatedUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const expiresLabel = expiresAt
    ? new Date(expiresAt).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      scrollBehavior="inside"
      classNames={{
        base: 'max-h-[min(92dvh,56rem)]',
        body: 'min-h-0',
      }}
    >
      <ModalContent>
        <ModalHeader>
          <h2 className="text-xl font-bold">Share a watch link</h2>
        </ModalHeader>

        <ModalBody>
          <div className="mb-4 shrink-0">
            <h3 className="font-semibold mb-2">{itemName}</h3>
            <p className="text-sm text-gray-400">
              Choose subtitle track or select &quot;No Subtitles&quot;
            </p>
            {loadingSubtitles && (
              <p className="text-xs text-gray-500 mt-1">Loading subtitle tracks…</p>
            )}
          </div>

          {!generatedUrl ? (
            <div className="flex min-h-0 flex-col gap-3">
              {fanoutEnabled && (
                <div className="shrink-0 space-y-2 rounded-lg border border-gray-700 bg-gray-800/40 p-3">
                  <RadioGroup
                    label="Who's watching?"
                    description="Just you and a friend, or do you have a group?"
                    value={audience}
                    onValueChange={(v) => {
                      if (v === 'friends' || v === 'group') setAudience(v);
                    }}
                    size="sm"
                    orientation="vertical"
                  >
                    <Radio value="friends">
                      Just you and a friend (1–2)
                    </Radio>
                    <Radio value="group">A group (3+)</Radio>
                  </RadioGroup>

                  <details className="text-xs text-gray-400">
                    <summary className="cursor-pointer text-gray-300 hover:text-white">
                      Why does this matter?
                    </summary>
                    <div className="mt-2 space-y-2 text-gray-400">
                      <p>
                        You are minting a link that lasts about a day so someone
                        can go watch. One or two people can stream through our
                        proxy. A group of three or more would hammer that path
                        once each - so we bake the video once, put it on Object
                        Storage, and everyone pulls the same playlist.
                      </p>
                      <AudienceFlowDiagram />
                    </div>
                  </details>

                  {/* Clip cap is a spike/dev safety rail (OCI_HLS_MAX_SECONDS), not prod UX. */}
                  {fanoutMaxSeconds > 0 && (
                    <p className="text-xs text-amber-400/80">
                      Dev only: group bake is capped at the first{' '}
                      {fanoutMaxSeconds} seconds of the title.
                    </p>
                  )}
                </div>
              )}

              {!useFanout && (
                <Select
                  label="URL lifetime"
                  aria-label="Stream URL lifetime"
                  selectedKeys={new Set([String(ttlHours)])}
                  onSelectionChange={(keys) => {
                    const key = Array.from(keys as Set<string>)[0];
                    const n = Number(key);
                    if (Number.isFinite(n) && n > 0) setTtlHours(n);
                  }}
                  size="sm"
                  className="max-w-xs shrink-0"
                  description={
                    extendedGated
                      ? 'Longer than default may require an admin Discord role.'
                      : 'After this time the stream URL stops working — remint from here.'
                  }
                >
                  {durations.map((d) => (
                    <SelectItem key={String(d.hours)} textValue={d.label}>
                      {d.label}
                      {d.extended ? ' (extended)' : ''}
                    </SelectItem>
                  ))}
                </Select>
              )}

              {useFanout && (
                <p className="shrink-0 text-xs text-amber-400/90">
                  Preparing the group link can take a few minutes (encode +
                  upload). Link lasts about a day on Object Storage - not the
                  proxy path.
                </p>
              )}

              <div
                className="min-h-0 max-h-[min(50dvh,24rem)] space-y-3 overflow-y-auto overscroll-contain pr-1"
                role="listbox"
                aria-label="Subtitle tracks"
              >
                <Card
                  isPressable
                  className="hover:bg-gray-700 transition-colors"
                  onPress={() => handleSubtitleSelect(null)}
                >
                  <CardBody className="py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-lg">🏳️</span>
                        <span className="font-medium">No Subtitles</span>
                      </div>
                      {loading && selectedSubtitleIndex === null && (
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
                      )}
                    </div>
                  </CardBody>
                </Card>

                {subtitles.map((subtitle) => (
                  <Card
                    key={subtitle.index}
                    isPressable
                    className="hover:bg-gray-700 transition-colors"
                    onPress={() => handleSubtitleSelect(subtitle.index)}
                  >
                    <CardBody className="py-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-lg">{getLanguageFlag(subtitle.language)}</span>
                          <div>
                            <span className="font-medium capitalize">
                              {subtitle.language === 'Unknown'
                                ? 'Unknown Language'
                                : subtitle.language}
                            </span>
                            <span className="text-sm text-gray-400 ml-2">
                              (Track {subtitle.index})
                            </span>
                          </div>
                        </div>
                        {loading && selectedSubtitleIndex === subtitle.index && (
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
                        )}
                      </div>
                    </CardBody>
                  </Card>
                ))}
              </div>

              {error && (
                <div className="shrink-0 p-3 bg-red-900/20 border border-red-600 rounded-lg">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-green-900/20 border border-green-600 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-green-400">✓</span>
                  <span className="font-medium text-green-400">
                    {copied ? 'Copied to clipboard!' : 'URL generated successfully'}
                  </span>
                </div>
                <p className="text-sm text-gray-300 mb-3">
                  Use this URL in VRChat or your preferred video player:
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={generatedUrl}
                    readOnly
                    className="flex-1 px-3 py-2 bg-gray-800 border border-gray-600 rounded text-sm font-mono"
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
                  <Button
                    onPress={copyToClipboard}
                    variant={copied ? 'solid' : 'ghost'}
                    color={copied ? 'success' : 'primary'}
                    size="sm"
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </Button>
                </div>
                {expiresLabel && (
                  <p className="text-xs text-gray-400 mt-3">
                    Expires {expiresLabel}. After that, remint a new URL here — no refresh.
                  </p>
                )}
                {!expiresLabel && generatedUrl.includes('objectstorage') && (
                  <p className="text-xs text-gray-400 mt-3">
                    Object Storage fan-out URL. Lifetime follows the bucket lifecycle
                    (~1 day) — remint when gone.
                  </p>
                )}
              </div>

              {error && (
                <div className="p-3 bg-red-900/20 border border-red-600 rounded-lg">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}
            </div>
          )}
        </ModalBody>

        <ModalFooter>
          <Button variant="ghost" onPress={onClose}>
            {generatedUrl ? 'Close' : 'Cancel'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

export default SubtitleModal;
