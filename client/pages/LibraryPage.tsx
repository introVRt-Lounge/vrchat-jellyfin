import React from 'react';
import { useParams } from 'react-router-dom';

function LibraryPage() {
  const { libraryId } = useParams();

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-8">Library {libraryId}</h1>
      <p>Library content will go here...</p>
    </div>
  );
}

export default LibraryPage;
