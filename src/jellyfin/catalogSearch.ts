/**
 * Client/server-shared catalog filter for instant library search.
 * Browse loads the top-level catalog once; typing filters in-memory.
 */

export type CatalogItem = {
    itemId: string;
    name: string | null;
    type?: string;
};

export function filterCatalogByQuery<T extends CatalogItem>(
    catalog: T[],
    query: string,
    limit?: number,
): T[] {
    const term = query.trim().toLowerCase();
    const matched = !term
        ? catalog
        : catalog.filter((item) => (item.name || "").toLowerCase().includes(term));
    if (limit == null || limit < 0) return matched;
    return matched.slice(0, limit);
}
