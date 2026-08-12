import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import searchService, { SearchResult } from '../src/services/search.service';
import { stripHtml } from '../src/utils/format';
import { useAuth } from '../src/context/AuthContext';
import { hasPermission } from '../src/utils/permissions';

const typeIcon: Record<string, string> = {
  request: 'confirmation_number',
  article: 'article',
  user: 'person',
};

const typeLabel: Record<string, string> = {
  request: 'Request',
  article: 'KB Article',
  user: 'User',
};

const SearchResults: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const query = searchParams.get('q') ?? '';

  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string>('all');

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    searchService
      .search(query)
      .then((data: any) => {
        // Global search returns { requests: [...], articles: [...], users: [...] }
        // Flatten into a unified SearchResult array
        const flat: SearchResult[] = [];
        if (Array.isArray(data)) {
          // Already a flat array (shouldn't happen with global search but handle gracefully)
          setResults(data);
          return;
        }
        if (data?.requests) {
          flat.push(...data.requests.map((r: any) => ({
            type: 'request' as const,
            id: r.id,
            title: stripHtml(r.summary || r.referenceNumber),
            excerpt: r.description || '',
            url: `/request/${r.referenceNumber || r.id}`,
            meta: { ref: r.referenceNumber, status: r.status, desk: r.serviceDesk?.name || '' },
          })));
        }
        if (data?.articles && hasPermission(user, 'kb:manage')) {
          flat.push(...data.articles.map((a: any) => ({
            type: 'article' as const,
            id: a.id,
            title: a.title,
            excerpt: a.content?.substring(0, 200) || '',
            url: `/kb/${a.id}`,
            meta: a.category ? { category: a.category } : undefined,
          })));
        }
        if (data?.users) {
          flat.push(...data.users.map((u: any) => ({
            type: 'user' as const,
            id: u.id,
            title: `${u.firstName} ${u.lastName}`,
            excerpt: u.email,
            url: '#',
            meta: u.department ? { department: u.department } : undefined,
          })));
        }
        setResults(flat);
      })
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  }, [query, user]);

  const filteredResults = useMemo(() => {
    if (activeFilter === 'all') return results;
    return results.filter(r => r.type === activeFilter);
  }, [results, activeFilter]);

  const counts = useMemo(() => ({
    all: results.length,
    request: results.filter(r => r.type === 'request').length,
    article: results.filter(r => r.type === 'article').length,
    user: results.filter(r => r.type === 'user').length,
  }), [results]);

  const handleCardClick = (result: SearchResult) => {
    if (result.type === 'request') {
      navigate(`/request/${result.meta?.ref || result.id}`);
    } else if (result.type === 'article') {
      navigate(`/kb/${result.id}`);
    }
  };

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 'var(--space-8) var(--space-6)' }}>
      <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 900, color: 'var(--color-text-primary)', marginBottom: 'var(--space-1)' }}>
        Search Results
      </h1>
      {query && (
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-6)' }}>
          Showing results for: <strong style={{ color: 'var(--color-text-primary)' }}>"{query}"</strong>
        </p>
      )}

      {/* Filter tabs */}
      {!loading && results.length > 0 && (
        <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-5)' }}>
          {[
            { key: 'all', label: 'All', count: counts.all },
            { key: 'request', label: 'Requests', count: counts.request },
            { key: 'article', label: 'Articles', count: counts.article },
            { key: 'user', label: 'Users', count: counts.user },
          ].filter(tab => tab.count > 0 || tab.key === 'all').map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveFilter(tab.key)}
              style={{
                padding: 'var(--space-2) var(--space-3)',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--text-sm)',
                fontWeight: activeFilter === tab.key ? 800 : 600,
                border: '1px solid',
                borderColor: activeFilter === tab.key ? 'var(--color-brand-700)' : 'var(--color-border)',
                background: activeFilter === tab.key ? 'var(--color-brand-50)' : 'var(--color-surface)',
                color: activeFilter === tab.key ? 'var(--color-brand-700)' : 'var(--color-text-secondary)',
                cursor: 'pointer',
                fontFamily: 'var(--font-sans)',
                transition: 'all 0.15s',
              }}
            >
              {tab.label} <span style={{ opacity: 0.7 }}>({tab.count})</span>
            </button>
          ))}
        </div>
      )}

      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-16)', color: 'var(--color-text-tertiary)' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 32, animation: 'spin 1s linear infinite' }}>sync</span>
        </div>
      )}

      {!loading && results.length === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-16)', color: 'var(--color-text-tertiary)' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 56, marginBottom: 'var(--space-4)', opacity: 0.3 }}>search_off</span>
          <p style={{ fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: 4 }}>No results found</p>
          {query && (
            <p style={{ fontSize: 'var(--text-sm)' }}>
              Try a different search term or check your spelling.
            </p>
          )}
        </div>
      )}

      {!loading && filteredResults.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {filteredResults.map((result) => (
            <li key={`${result.type}-${result.id}`}>
              <button
                onClick={() => handleCardClick(result)}
                style={{
                  width: '100%', textAlign: 'left',
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-lg)',
                  padding: 'var(--space-4) var(--space-5)',
                  cursor: 'pointer', fontFamily: 'var(--font-sans)',
                  transition: 'box-shadow 0.15s, border-color 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow-md)'; e.currentTarget.style.borderColor = 'var(--color-brand-300)'; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; e.currentTarget.style.borderColor = 'var(--color-border)'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-1)' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18, color: typeIcon[result.type] === 'confirmation_number' ? 'var(--color-brand-500)' : typeIcon[result.type] === 'article' ? 'var(--color-success)' : 'var(--color-warning)', verticalAlign: 'middle' }}>
                    {typeIcon[result.type] || 'search'}
                  </span>
                  <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-brand-700)' }}>
                    {typeLabel[result.type] || result.type}
                  </span>
                </div>
                <p style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 'var(--space-1)' }}>{result.title}</p>
                {result.excerpt && (
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.5, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{result.excerpt}</p>
                )}
                {result.meta && Object.keys(result.meta).length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                    {Object.entries(result.meta).map(([key, value]) => (
                      <span
                        key={key}
                        style={{ fontSize: 'var(--text-xs)', background: 'var(--color-surface-subtle)', color: 'var(--color-text-secondary)', borderRadius: 'var(--radius-sm)', padding: '2px 8px' }}
                      >
                        {key}: {String(value)}
                      </span>
                    ))}
                  </div>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Spinner keyframe */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default SearchResults;