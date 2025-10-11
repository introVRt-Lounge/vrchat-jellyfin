import React from 'react';
import { useParams } from 'react-router-dom';

function TVShowPage() {
  const { showId } = useParams();

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-8">TV Show {showId}</h1>
      <p>Seasons will go here...</p>
    </div>
  );
}

export default TVShowPage;
