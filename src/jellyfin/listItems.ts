/**
 * Lightweight library list/search DTOs.
 * List endpoints must stay free of MediaStreams so Jellyfin serves DB/index
 * results instead of hydrating (and potentially probing) every media file.
 */

export type SubtitleTrack = {
    index: number;
    language: string;
};

/** One Jellyfin MediaSource (file / version) for the mint UI. */
export type MediaSourceOption = {
    /** Jellyfin MediaSource Id; null = default / unspecified (omit from stream URL). */
    id: string | null;
    label: string;
    sizeBytes: number | null;
    container: string | null;
    subtitles: SubtitleTrack[];
};

export type LibraryListItem = {
    itemId: string;
    name: string | null;
    type: string;
    thumbnailUrl: string | null;
    hasSubtitles: boolean;
    subtitles: SubtitleTrack[];
    /** Present on detail responses; empty on browse/search. */
    mediaSources: MediaSourceOption[];
};

export type SearchHintLike = {
    ItemId?: string;
    Name?: string | null;
    Type?: string | null;
    PrimaryImageTag?: string | null;
};

export type MediaStreamLike = {
    Type?: string | null;
    Index?: number | null;
    Language?: string | null;
};

export type MediaSourceLike = {
    Id?: string | null;
    Name?: string | null;
    Path?: string | null;
    Size?: number | null;
    Container?: string | null;
    MediaStreams?: MediaStreamLike[] | null;
};

export type ItemLike = {
    Id?: string | null;
    Name?: string | null;
    Type?: string | null;
    IndexNumber?: number | null;
    ImageTags?: { [key: string]: string } | null;
    MediaStreams?: MediaStreamLike[] | null;
    MediaSources?: MediaSourceLike[] | null;
};

function mapSubtitleStreams(streams: MediaStreamLike[] | null | undefined): SubtitleTrack[] {
    return (streams || [])
        .filter((s) => s.Type === "Subtitle")
        .map((stream) => ({
            index: stream.Index ?? 0,
            language: stream.Language || "Unknown",
        }));
}

/** Human label for a MediaSource: Name, else basename of Path, else container/size. */
export function formatMediaSourceLabel(source: MediaSourceLike): string {
    const named = (source.Name || "").trim();
    if (named) return named;

    const path = (source.Path || "").trim();
    if (path) {
        const base = path.split(/[/\\]/).pop() || path;
        return base.replace(/\.[^.]+$/, "") || base;
    }

    const container = (source.Container || "").trim();
    const size = typeof source.Size === "number" && source.Size > 0 ? source.Size : null;
    if (container && size != null) {
        const gib = size / (1024 * 1024 * 1024);
        return `${container.toUpperCase()} · ${gib >= 1 ? gib.toFixed(1) + " GiB" : Math.round(size / (1024 * 1024)) + " MiB"}`;
    }
    if (container) return container.toUpperCase();
    return "Default version";
}

export function mapMediaSources(
    item: ItemLike,
    opts: { includeSubtitles?: boolean } = {},
): MediaSourceOption[] {
    const includeSubtitles = opts.includeSubtitles === true;
    const sources = item.MediaSources;
    if (sources && sources.length > 0) {
        return sources
            .filter((s) => s && (s.Id || s.Path || s.Name))
            .map((s) => ({
                id: s.Id ? String(s.Id) : null,
                label: formatMediaSourceLabel(s),
                sizeBytes: typeof s.Size === "number" ? s.Size : null,
                container: s.Container ? String(s.Container) : null,
                subtitles: includeSubtitles ? mapSubtitleStreams(s.MediaStreams) : [],
            }));
    }

    if (!includeSubtitles) return [];

    // Single synthetic source from top-level MediaStreams (legacy / no MediaSources field).
    return [
        {
            id: null,
            label: "Default version",
            sizeBytes: null,
            container: null,
            subtitles: mapSubtitleStreams(item.MediaStreams),
        },
    ];
}

export function mapSearchHintToListItem(
    hint: SearchHintLike,
    imageUrl: (itemId: string, imageType: string, imageTags?: { [key: string]: string } | null) => string | null,
): LibraryListItem | null {
    const itemId = hint.ItemId;
    if (!itemId) return null;
    const tags = hint.PrimaryImageTag ? { Primary: hint.PrimaryImageTag } : null;
    return {
        itemId,
        name: hint.Name ?? null,
        type: hint.Type ?? "Unknown",
        thumbnailUrl: imageUrl(itemId, "Primary", tags),
        hasSubtitles: false,
        subtitles: [],
        mediaSources: [],
    };
}

export function mapItemToListItem(
    item: ItemLike,
    imageUrl: (itemId: string, imageType: string, imageTags?: { [key: string]: string } | null) => string | null,
    opts: { includeSubtitles?: boolean } = {},
): LibraryListItem | null {
    const itemId = item.Id;
    if (!itemId) return null;
    const includeSubtitles = opts.includeSubtitles === true;
    const mediaSources = mapMediaSources(item, opts);
    const subtitleStreams = includeSubtitles
        ? mediaSources.length > 0
            ? mediaSources[0].subtitles
            : mapSubtitleStreams(item.MediaStreams)
        : [];
    return {
        itemId,
        name: item.Name ?? null,
        type: item.Type ?? "Unknown",
        thumbnailUrl: imageUrl(itemId, "Primary", item.ImageTags),
        hasSubtitles: subtitleStreams.length > 0,
        subtitles: subtitleStreams,
        mediaSources: includeSubtitles ? mediaSources : [],
    };
}

/** Fields safe for browse/search list queries (no MediaStreams). */
export const LIST_ITEM_FIELDS_LIGHT = ["PrimaryImageAspectRatio"] as const;

/** Fields for single-item detail (versions + subtitles / mint UI). */
export const ITEM_DETAIL_FIELDS = ["PrimaryImageAspectRatio", "MediaStreams", "MediaSources"] as const;
