import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import searchService, { SearchResult } from '../src/services/search.service';

const typeIcon: Record<SearchResult['type'], string> = {
  request: 'confirmation_number',
  article: 'article',
  user: 'person',
};

const typeLabel: Record<SearchResult['type'], string> = {
  request: 'Request',
  article: 'Article',
  user: 'User',
};

const SearchResults: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const query = searchParams.get('q') ?? '';

  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    searchService
      .search(query)
      .then(setResults)
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  }, [query]);

  const handleCardClick = (result: SearchResult) => {
    if (result.type === 'request') {
      navigate(`/request/${result.id}`);
    } else if (result.type === 'article') {
      navigate(`/kb/${result.id}`);
    }
  };

  return (
    <div className="mx-auto max-w-[900px] px-6 py-8">
      <h1 className="text-2xl font-semibold text-gray-900 mb-2">Search Results</h1>
      {query && (
        <p className="text-sm text-gray-500 mb-6">
          Showing results for: <span className="font-medium text-gray-700">"{query}"</span>
        </p>
      )}

      {loading && (
        <div className="flex items-center justify-center py-16">
          <span className="material-icons animate-spin text-blue-500 text-4xl">sync</span>
        </div>
      )}

      {!loading && results.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <span className="material-icons text-6xl mb-4">search_off</span>
          <p className="text-lg font-medium">No results found</p>
          {query && (
            <p className="text-sm mt-1">
              Try a different search term or check your spelling.
            </p>
          )}
        </div>
      )}

      {!loading && results.length > 0 && (
        <ul className="space-y-3">
          {results.map((result) => (
            <li key={`${result.type}-${result.id}`}>
              <button
                onClick={() => handleCardClick(result)}
                className="w-full text-left bg-white border border-gray-200 rounded-lg px-5 py-4 hover:shadow-md hover:border-blue-400 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="material-icons text-blue-500 text-lg">
                    {typeIcon[result.type]}
                  </span>
                  <span className="text-xs font-semibold uppercase tracking-wide text-blue-500">
                    {typeLabel[result.type]}
                  </span>
                </div>
                <p className="text-base font-medium text-gray-900">{result.title}</p>
                {result.excerpt && (
                  <p className="text-sm text-gray-500 mt-1 line-clamp-2">{result.excerpt}</p>
                )}
                {result.meta && Object.keys(result.meta).length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {Object.entries(result.meta).map(([key, value]) => (
                      <span
                        key={key}
                        className="text-xs bg-gray-100 text-gray-600 rounded px-2 py-0.5"
                      >
                        {key}: {value}
                      </span>
                    ))}
                  </div>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default SearchResults;
