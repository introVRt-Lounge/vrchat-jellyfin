import React from 'react';
import { useParams } from 'react-router-dom';

function SeasonPage() {
  const { seasonId } = useParams();

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-8">Season {seasonId}</h1>
      <p>Episodes will go here...</p>
    </div>
  );
}

export default SeasonPage;
