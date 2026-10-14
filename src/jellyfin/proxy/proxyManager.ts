// src/jellyfin/proxy/proxyManager.ts

import Proxy, { ProxyOptions, PersistedProxy } from "./proxy";
import ProxyStore from "./proxyStore";
import { defaultTtlMs } from "./streamTtl";

export default class ProxyManager {
    public static proxies: Map<string, Proxy> = new Map();
    private static store: ProxyStore | null = null;
    private static cleanTimer: NodeJS.Timeout | null = null;

    /** Default capability TTL: 24 hours. Override with PROXY_TTL_MS. */
    public static get PROXY_TIMEOUT(): number {
        return defaultTtlMs();
    }

    public static init(store?: ProxyStore) {
        ProxyManager.store = store ?? ProxyStore.fromEnv();
        ProxyManager.proxies = new Map();

        for (const entry of ProxyManager.store.load()) {
            const proxy = ProxyManager.fromPersisted(entry);
            if (proxy && !ProxyManager.isExpired(proxy)) {
                ProxyManager.proxies.set(proxy.id, proxy);
            }
        }

        if (ProxyManager.cleanTimer) {
            clearInterval(ProxyManager.cleanTimer);
        }
        ProxyManager.cleanTimer = setInterval(ProxyManager.cleanProxies, 1000 * 60 * 60);
        // Avoid keeping the process alive solely for the cleaner in tests
        ProxyManager.cleanTimer.unref?.();

        ProxyManager.persist();
        console.log(`ProxyManager loaded ${ProxyManager.proxies.size} active capability URL(s)`);
    }

    public static createProxy(itemId: string, options?: ProxyOptions, ttlMs?: number) {
        const resolvedTtl =
            typeof ttlMs === "number" && Number.isFinite(ttlMs) && ttlMs > 0
                ? ttlMs
                : ProxyManager.PROXY_TIMEOUT;
        const proxy = new Proxy(itemId, options, undefined, undefined, resolvedTtl);
        ProxyManager.proxies.set(proxy.id, proxy);
        ProxyManager.persist();
        return proxy;
    }

    /** Returns proxy if present and not expired; deletes expired entries. */
    public static getProxy(id: string) {
        const proxy = ProxyManager.proxies.get(id);
        if (!proxy) {
            return undefined;
        }
        if (ProxyManager.isExpired(proxy)) {
            ProxyManager.deleteProxy(id);
            return undefined;
        }
        return proxy;
    }

    public static deleteProxy(id: string) {
        const deleted = ProxyManager.proxies.delete(id);
        if (deleted) {
            ProxyManager.persist();
        }
        return deleted;
    }

    public static getProxies() {
        return Array.from(ProxyManager.proxies.values());
    }

    public static cleanProxies() {
        let removed = 0;
        ProxyManager.proxies.forEach((proxy) => {
            if (ProxyManager.isExpired(proxy)) {
                ProxyManager.proxies.delete(proxy.id);
                removed++;
            }
        });
        if (removed > 0) {
            ProxyManager.persist();
        }
    }

    public static isExpired(proxy: Proxy, now: Date = new Date()): boolean {
        const ttl = proxy.ttlMs ?? ProxyManager.PROXY_TIMEOUT;
        return now.getTime() - proxy.createdAt.getTime() > ttl;
    }

    private static persist() {
        if (!ProxyManager.store) {
            return;
        }
        const entries: PersistedProxy[] = Array.from(ProxyManager.proxies.values()).map((p) => ({
            id: p.id,
            itemId: p.itemId,
            createdAt: p.createdAt.toISOString(),
            options: p.options,
            ...(p.ttlMs != null ? { ttlMs: p.ttlMs } : {}),
        }));
        try {
            ProxyManager.store.save(entries);
        } catch (err) {
            console.error("Failed to persist proxy store:", err);
        }
    }

    private static fromPersisted(entry: PersistedProxy): Proxy | null {
        if (!entry?.id || !entry?.itemId || !entry?.createdAt) {
            return null;
        }
        const createdAt = new Date(entry.createdAt);
        if (Number.isNaN(createdAt.getTime())) {
            return null;
        }
        const ttlMs =
            typeof entry.ttlMs === "number" && Number.isFinite(entry.ttlMs) && entry.ttlMs > 0
                ? entry.ttlMs
                : null;
        return new Proxy(entry.itemId, entry.options, entry.id, createdAt, ttlMs);
    }
}
