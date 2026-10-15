import React, { useEffect, useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import LibrariesPage from './pages/LibrariesPage';
import LibraryPage from './pages/LibraryPage';
import TVShowPage from './pages/TVShowPage';
import SeasonPage from './pages/SeasonPage';
import { applyUiTheme, fetchUiConfig } from './uiConfig';

function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchUiConfig().then((cfg) => {
      if (cancelled) return;
      applyUiTheme(cfg.theme);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Avoid a flash of default chrome before lounge tokens apply.
  if (!ready) {
    return (
      <div
        className="app-shell min-h-screen bg-gray-900 text-white flex items-center justify-center"
        aria-busy="true"
      >
        <p className="lounge-eyebrow">Loading…</p>
      </div>
    );
  }

  return (
    <div className="app-shell min-h-screen bg-gray-900 text-white">
      <Routes>
        <Route path="/" element={<LibrariesPage />} />
        <Route path="/library/:libraryId" element={<LibraryPage />} />
        <Route path="/tvshow/:showId" element={<TVShowPage />} />
        <Route path="/season/:seasonId" element={<SeasonPage />} />
      </Routes>
    </div>
  );
}

export default App;
