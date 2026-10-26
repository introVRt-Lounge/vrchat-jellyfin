/**
 * Browse click routing for library grids.
 * Never treat libraryType=TvShows as "everything is a Series" — SearchHints
 * return Episodes/Seasons, and Episode-as-show parentId returns root libraries.
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
    ImageTags?: { [key: string]: string } | null;
};

/** Drop CollectionFolder / UserView junk when parentId is not a Series. */
export function filterSeasonItems<T extends SeasonLike>(items: T[]): T[] {
    return items.filter((item) => item.Type === "Season");
}
