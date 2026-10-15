// src/jellyfin/client.ts

import { Api, Jellyfin } from "@jellyfin/sdk";
import { getUserViewsApi } from "@jellyfin/sdk/lib/utils/api/user-views-api";
import { getItemsApi } from "@jellyfin/sdk/lib/utils/api/items-api";
import { getSearchApi } from "@jellyfin/sdk/lib/utils/api/search-api";
import { ItemFields } from "@jellyfin/sdk/lib/generated-client/models/item-fields";
import fetch from "node-fetch";
import { resolve } from "path";
import { ProxyOptions, SubtitleMethod } from "./proxy/proxy";
import {
    buildPublicImageUrl,
    buildUpstreamImageUrl,
    ImageUrlOptions,
} from "./imageUrl";
import { mapItemToListItem, mapSearchHintToListItem } from "./listItems";
import { resolveJellyfinDeviceId } from "./deviceId";

const encodingSettings: Record<string, string> = require(resolve("./encodingSettings.js")).encodingSettings;

export default class JellyfinClient {
    public static readonly APP_NAME = "Jellyfin VRChat Proxy (jellyfin-vrchat)";

    private _sdk: Jellyfin;
    private _api: Api;

    public userId?: string;

    constructor(public serverUrl: string, private username: string, private password: string) {
        // Ensure the serverUrl does not end with a slash
        this.serverUrl = serverUrl.replace(/\/+$/, "");

        const deviceId = resolveJellyfinDeviceId();

        this._sdk = new Jellyfin({
            clientInfo: {
                name: JellyfinClient.APP_NAME,
                version: process.env.npm_package_version || "0.0.0",
            },
            deviceInfo: {
                name: `${JellyfinClient.APP_NAME} ${process.env.npm_package_version || "0.0.0"} | ${process.platform} | ${process.arch}`,
                id: deviceId,
            },
        });

        this._api = this._sdk.createApi(this.serverUrl);
    }

    public get apiKey() {
        return this._api.accessToken;
    }

    public async authenticate() {
        try {
            const auth = await this._api.authenticateUserByName(this.username, this.password);
            this.userId = auth.data.User?.Id;
            return auth.status == 200;
        } catch (e) {
            console.error("Failed to authenticate with Jellyfin, check your username and password", e);
            return false; // Return false instead of exiting
        }
    }

    public async getPlayableMedia() {
        const viewsResponse = await getUserViewsApi(this._api).getUserViews({
            userId: this.userId!,
        });

        const views = viewsResponse.data.Items || [];
        const items = await Promise.all(
            views.map(async (view) => {
                const itemsResponse = await this.getSubItemsRecursive(view.Id!);

                return {
                    itemId: view.Id,
                    name: view.Name,
                    subItems: itemsResponse,
                };
            })
        ).catch((e) => {
            console.error("Failed to get playable media", e);
        });
        return items;
    }

    public async getSubItems(parent: string) {
        const itemsResponse = await getItemsApi(this._api).getItems({
            userId: this.userId!,
            parentId: parent,
        });

        return itemsResponse.data.Items;
    }

    public async getSubItemsRecursive(parent: string): Promise<NestedItem[]> {
        const items = await this.getSubItems(parent);

        if (!items || items.length == 0) {
            return [];
        }

        const subItems = await Promise.all(
            items.map(async (item) => {
                if (!item.IsFolder) {
                    return {
                        itemId: item.Id!,
                        name: item.Name || undefined,
                        playable: item.MediaType == "Video",
                        episode: item.IndexNumber || undefined,
                    };
                }

                return {
                    itemId: item.Id!,
                    name: item.Name || undefined,
                    subItems: await this.getSubItemsRecursive(item.Id!),
                };
            })
        );

        return subItems;
    }

    /** Build Jellyfin Videos/.../stream URL (includes api_key). Used by proxy + OCI HLS bake. */
    public buildVideoStreamUrl(itemId: string, options?: ProxyOptions): string {
        const url = new URL(`${this.serverUrl}/Videos/${itemId}/stream`);
        url.searchParams.set("api_key", this.apiKey);

        // Default encoding settings
        url.searchParams.set("container", "mp4");
        url.searchParams.set("audioCodec", "aac");
        url.searchParams.set("videoCodec", "h264");

        // Override encoding settings if provided
        for (const [k, v] of Object.entries(encodingSettings)) {
            url.searchParams.set(k, v);
        }

        // Include subtitle parameters if provided
        if (options?.subtitleStreamIndex !== undefined) {
            url.searchParams.set("SubtitleMethod", options.subtitleMethod || SubtitleMethod.Encode);
            url.searchParams.set("SubtitleCodec", "srt"); // Adjust the codec if necessary
            url.searchParams.set("SubtitleStreamIndex", options.subtitleStreamIndex.toString());
        }

        return url.toString();
    }

    /**
     * Direct file stream for ffmpeg bake (no Jellyfin live-transcode).
     * `static=true` avoids SubtitleMethod defaults that break HTTP input to ffmpeg.
     */
    public buildStaticMediaUrl(itemId: string): string {
        const url = new URL(`${this.serverUrl}/Videos/${itemId}/stream`);
        url.searchParams.set("api_key", this.apiKey);
        url.searchParams.set("static", "true");
        return url.toString();
    }

    public async getVideoStream(itemId: string, options?: ProxyOptions) {
        const streamUrl = this.buildVideoStreamUrl(itemId, options);
        console.log(`Requesting video stream from ${streamUrl}`);

        const response = await fetch(streamUrl, {
            headers: {
                "User-Agent": JellyfinClient.APP_NAME,
            },
        });

        return response;
    }

    // New method to fetch available subtitle streams
    public async getSubtitleStreams(itemId: string) {
        const url = `${this.serverUrl}/Items/${itemId}?Fields=MediaStreams&api_key=${this.apiKey}`;
        const response = await fetch(url, {
            headers: {
                "User-Agent": JellyfinClient.APP_NAME,
            },
        });
        const data = await response.json();
        const subtitleStreams = data.MediaStreams.filter((stream: any) => stream.Type === "Subtitle");
        return subtitleStreams;
    }

    public getRandomItem(items: NestedItem[]): NestedItem | undefined {
        if (items.length == 0) {
            return undefined;
        }

        const item = items[Math.floor(Math.random() * items.length)];
        if (item.subItems && item.subItems.length > 0) {
            return this.getRandomItem(item.subItems);
        }

        return item;
    }

    // New methods for modern UI
    public async getLibraries() {
        const viewsResponse = await getUserViewsApi(this._api).getUserViews({
            userId: this.userId!,
        });

        const views = viewsResponse.data.Items || [];
        return views.map(view => ({
            itemId: view.Id,
            name: view.Name,
            type: view.CollectionType,
            thumbnailUrl: this.getImageUrl(view.Id!, 'Primary', view.ImageTags),
        }));
    }

    public async getLibraryItems(libraryId: string, searchTerm?: string, limit: number = 50, offset: number = 0) {
        const term = searchTerm?.trim();
        const imageUrl = this.getImageUrl.bind(this);

        // SearchHints is the DB/index path. Do not use Items+MediaStreams here —
        // that hydrates (and can probe) every hit and sounds like a raid rebuild.
        if (term) {
            const hintsResponse = await getSearchApi(this._api).get({
                userId: this.userId!,
                searchTerm: term,
                parentId: libraryId,
                startIndex: offset,
                limit,
                includeMedia: true,
                includePeople: false,
                includeGenres: false,
                includeStudios: false,
                includeArtists: false,
            });
            return (hintsResponse.data.SearchHints || [])
                .map((hint) => mapSearchHintToListItem(hint, imageUrl))
                .filter((row): row is NonNullable<typeof row> => row != null);
        }

        const itemsResponse = await getItemsApi(this._api).getItems({
            userId: this.userId!,
            parentId: libraryId,
            limit,
            startIndex: offset,
            fields: [ItemFields.PrimaryImageAspectRatio],
        });

        return (itemsResponse.data.Items || [])
            .map((item) => mapItemToListItem(item, imageUrl, { includeSubtitles: false }))
            .filter((row): row is NonNullable<typeof row> => row != null);
    }

    public async getTVShowSeasons(showId: string) {
        const seasonsResponse = await getItemsApi(this._api).getItems({
            userId: this.userId!,
            parentId: showId,
            fields: [ItemFields.PrimaryImageAspectRatio],
        });

        const seasons = seasonsResponse.data.Items || [];
        return seasons.map(season => ({
            itemId: season.Id,
            name: season.Name,
            index: season.IndexNumber,
            thumbnailUrl: this.getImageUrl(season.Id!, 'Primary', season.ImageTags),
        }));
    }

    public async getSeasonEpisodes(seasonId: string) {
        const episodesResponse = await getItemsApi(this._api).getItems({
            userId: this.userId!,
            parentId: seasonId,
            fields: [ItemFields.PrimaryImageAspectRatio],
        });

        const imageUrl = this.getImageUrl.bind(this);
        return (episodesResponse.data.Items || [])
            .map((episode) => {
                const row = mapItemToListItem(episode, imageUrl, { includeSubtitles: false });
                if (!row) return null;
                return { ...row, index: episode.IndexNumber };
            })
            .filter((row): row is NonNullable<typeof row> => row != null);
    }

    public async getItemDetails(itemId: string) {
        const itemResponse = await getItemsApi(this._api).getItems({
            userId: this.userId!,
            ids: [itemId],
            fields: [ItemFields.PrimaryImageAspectRatio, ItemFields.MediaStreams],
        });

        const item = itemResponse.data.Items?.[0];
        if (!item) return null;
        return mapItemToListItem(item, this.getImageUrl.bind(this), { includeSubtitles: true });
    }

    /**
     * Browser-safe thumbnail path proxied by this app (`/img/:itemId`).
     * Never includes Jellyfin hostnames or api_key.
     */
    private getImageUrl(
        itemId: string,
        imageType: string,
        imageTags?: { [key: string]: string } | null,
    ): string | null {
        const tag = imageTags?.[imageType];
        return buildPublicImageUrl(itemId, imageType, tag ? { tag } : {});
    }

    /** Server-side fetch of a Jellyfin item image (credential stays here). */
    public async getItemImage(itemId: string, imageType: string, options: ImageUrlOptions = {}) {
        const url = buildUpstreamImageUrl(this.serverUrl, itemId, imageType, this.apiKey, options);
        return fetch(url, {
            headers: {
                "User-Agent": JellyfinClient.APP_NAME,
            },
        });
    }
}

interface NestedItem {
    itemId: string;
    name?: string;
    subItems?: NestedItem[];
    playable?: boolean;
    episode?: number;
}
