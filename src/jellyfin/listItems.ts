/**
 * Lightweight library list/search DTOs.
 * List endpoints must stay free of MediaStreams so Jellyfin serves DB/index
 * results instead of hydrating (and potentially probing) every media file.
 */

export type LibraryListItem = {
    itemId: string;
    name: string | null;
    type: string;
    thumbnailUrl: string | null;
    hasSubtitles: boolean;
    subtitles: Array<{ index: number; language: string }>;
};

export type SearchHintLike = {
    ItemId?: string;
    Name?: string | null;
    Type?: string | null;
    PrimaryImageTag?: string | null;
};

export type ItemLike = {
    Id?: string | null;
    Name?: string | null;
    Type?: string | null;
    IndexNumber?: number | null;
    ImageTags?: { [key: string]: string } | null;
    MediaStreams?: Array<{
        Type?: string | null;
        Index?: number | null;
        Language?: string | null;
    }> | null;
};

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
    const subtitleStreams = includeSubtitles
        ? (item.MediaStreams || []).filter((s) => s.Type === "Subtitle")
        : [];
    return {
        itemId,
        name: item.Name ?? null,
        type: item.Type ?? "Unknown",
        thumbnailUrl: imageUrl(itemId, "Primary", item.ImageTags),
        hasSubtitles: subtitleStreams.length > 0,
        subtitles: subtitleStreams.map((stream) => ({
            index: stream.Index ?? 0,
            language: stream.Language || "Unknown",
        })),
    };
}

/** Fields safe for browse/search list queries (no MediaStreams). */
export const LIST_ITEM_FIELDS_LIGHT = ["PrimaryImageAspectRatio"] as const;

/** Fields for single-item detail (subtitles / mint UI). */
export const ITEM_DETAIL_FIELDS = ["PrimaryImageAspectRatio", "MediaStreams"] as const;
