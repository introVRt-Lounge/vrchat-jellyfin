/**
 * Browse click routing for library grids.
 * Never treat libraryType=TvShows as "everything is a Series" — SearchHints
 * return Episodes/Seasons, and Episode-as-show parentId returns root libraries
 * (or, with includeItemTypes=Season, every Season in the library).
 */

export type LibraryItemRef = {
    itemId: string;
    type: string;
};

export type BrowseAction =
    | { action: "show"; showId: string }
    | { action: "season"; seasonId: string }
    | { action: "mint"; itemId: string };

export function resolveLibraryItemAction(item: LibraryItemRef): BrowseAction {
    switch (item.type) {
        case "Series":
            return { action: "show", showId: item.itemId };
        case "Season":
            return { action: "season", seasonId: item.itemId };
        default:
            return { action: "mint", itemId: item.itemId };
    }
}

export type SeasonLike = {
    Id?: string | null;
    Name?: string | null;
    Type?: string | null;
    IndexNumber?: number | null;
    ParentId?: string | null;
    SeriesId?: string | null;
    ImageTags?: { [key: string]: string } | null;
};

/**
 * Keep Season rows that belong to this series.
 * When Jellyfin ignores a non-Series parentId + includeItemTypes=Season, it can
 * return every Season in the library — ParentId/SeriesId must still match.
 */
export function filterSeasonItems<T extends SeasonLike>(
    items: T[],
    showId?: string,
): T[] {
    const seasons = items.filter((item) => item.Type === "Season");
    if (!showId) return seasons;
    return seasons.filter(
        (item) => item.ParentId === showId || item.SeriesId === showId,
    );
}
