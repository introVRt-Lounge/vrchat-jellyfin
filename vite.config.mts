import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/**
 * Cloudflare Access + Vite's crossorigin=anonymous on scripts means Access
 * cookies are omitted for lazy chunks. That yields ERR_HTTP2_PROTOCOL_ERROR /
 * "Failed to fetch dynamically imported module" for index2.js (HeroUI Modal),
 * so mint never opens. Strip crossorigin and keep a single JS bundle.
 */
function stripCrossorigin(): Plugin {
    return {
        name: "strip-crossorigin",
        transformIndexHtml(html) {
            return html.replace(/\s+crossorigin(?:="[^"]*")?/g, "");
        },
    };
}

export default defineConfig({
    root: "client",
    base: "/assets",
    plugins: [react(), tailwindcss(), stripCrossorigin()],
    build: {
        target: "esnext",
        outDir: "../dist/client",
        emptyOutDir: true,
        sourcemap: true,
        cssCodeSplit: false,
        modulePreload: false,
        rollupOptions: {
            output: {
                // One JS file - no lazy index2.js fetch under Access.
                inlineDynamicImports: true,
                entryFileNames: "index.js",
                // Keep stable /assets/index.css for Access Bypass + cache.
                assetFileNames: (info) =>
                    info.name && info.name.endsWith(".css")
                        ? "index.css"
                        : "[name].[ext]",
                sourcemapFileNames: "[name].js.map",
            },
        },
    },
});
