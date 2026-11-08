/**
 * Deep-link routing for /item/:jellyfinItemId (Jellyfin → vrchat-jellyfin bridge).
 */

export type ItemDeeplinkDetails = {
    itemId?: string;
    name?: string | null;
    type?: string | null;
};

export type ItemDeeplinkAction =
    | { action: "mint"; itemId: string; itemName: string }
    | { action: "show"; showId: string }
    | { action: "season"; seasonId: string }
    | { action: "unsupported"; type: string };

export function resolveItemDeeplink(details: ItemDeeplinkDetails): ItemDeeplinkAction {
    const itemId = (details.itemId || "").trim();
    const itemName = (details.name || "Unknown").trim() || "Unknown";
    const type = (details.type || "Unknown").trim() || "Unknown";

    switch (type) {
        case "Movie":
        case "Episode":
        case "Video":
            return { action: "mint", itemId, itemName };
        case "Series":
            return { action: "show", showId: itemId };
        case "Season":
            return { action: "season", seasonId: itemId };
        default:
            return { action: "unsupported", type };
    }
}
