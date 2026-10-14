import express from "express";
import { identityFromRequestHeaders } from "./accessIdentity";
import { postMovieRequestQueued } from "./discordNotify";
import { RadarrClient } from "./radarrClient";
import { MovieRequestStore } from "./requestStore";

export function mountMovieRequestRoutes(
    app: express.Express,
    opts: {
        enabled: boolean;
        radarr: RadarrClient | null;
        store: MovieRequestStore | null;
        webhookUrl: string | null;
    },
): void {
    app.get("/api/movie-requests/status", (_req, res) => {
        res.json({ enabled: opts.enabled });
    });

    app.get("/api/movie-requests/lookup", async (req, res) => {
        if (!opts.enabled || !opts.radarr) {
            res.status(503).json({ error: "Movie requests are not configured." });
            return;
        }
        const identity = identityFromRequestHeaders({
            get: (n) => req.header(n) || undefined,
        });
        if (!identity) {
            res.status(401).json({
                error: "Could not identify Discord user. Sign in via Discord Access (OIDC claim id required).",
            });
            return;
        }

        const q = String(req.query.q || "").trim();
        if (q.length < 2) {
            res.status(400).json({ error: "Search query too short." });
            return;
        }
        if (q.length > 120) {
            res.status(400).json({ error: "Search query too long." });
            return;
        }

        try {
            const hits = await opts.radarr.lookup(q, 5);
            res.json({
                results: hits.map((h) => ({
                    tmdbId: h.tmdbId,
                    title: h.title,
                    year: h.year,
                    posterUrl: h.posterUrl,
                    alreadyAvailable: h.hasFile,
                })),
            });
        } catch (err) {
            console.error("movie request lookup error:", err);
            res.status(502).json({ error: "Lookup failed. Try again shortly." });
        }
    });

    app.post("/api/movie-requests", async (req, res) => {
        if (!opts.enabled || !opts.radarr || !opts.store || !opts.webhookUrl) {
            res.status(503).json({ error: "Movie requests are not configured." });
            return;
        }
        const identity = identityFromRequestHeaders({
            get: (n) => req.header(n) || undefined,
        });
        if (!identity) {
            res.status(401).json({
                error: "Could not identify Discord user. Sign in via Discord Access (OIDC claim id required).",
            });
            return;
        }

        const tmdbId = Number(req.body?.tmdbId);
        if (!Number.isInteger(tmdbId) || tmdbId < 1) {
            res.status(400).json({ error: "Invalid movie selection." });
            return;
        }

        const existingOpen = opts.store.findOpen(tmdbId, identity.discordUserId);
        if (existingOpen) {
            res.json({
                ok: true,
                message: "We already have your request. We'll ping this channel when it's ready.",
                requestId: existingOpen.id,
            });
            return;
        }

        try {
            const result = await opts.radarr.requestMovie(tmdbId);
            if (result.status === "already_available") {
                res.json({
                    ok: true,
                    message: "That title may already be in the library — try searching again shortly.",
                    alreadyAvailable: true,
                });
                return;
            }

            const record = opts.store.add({
                tmdbId,
                title: result.title,
                year: result.year,
                discordUserId: identity.discordUserId,
                radarrId: result.movie.id || null,
                status: "queued",
            });

            try {
                await postMovieRequestQueued({
                    webhookUrl: opts.webhookUrl,
                    discordUserId: identity.discordUserId,
                    title: result.title,
                    year: result.year,
                });
            } catch (notifyErr) {
                console.error("movie request queued notify failed:", notifyErr);
            }

            res.json({
                ok: true,
                message: "Got it — we'll try to add that. You'll get a ping here when it's ready.",
                requestId: record.id,
            });
        } catch (err) {
            console.error("movie request create error:", err);
            res.status(502).json({ error: "Could not queue that request. Try again later." });
        }
    });
}
