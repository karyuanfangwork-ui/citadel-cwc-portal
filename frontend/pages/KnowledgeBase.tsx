import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import kbService, { Article } from '../src/services/kb.service';

export default function KnowledgeBase() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    kbService
      .getArticles()
      .then(setArticles)
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return articles;
    return articles.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        (a.excerpt ?? '').toLowerCase().includes(q) ||
        a.tags.some((t) => t.toLowerCase().includes(q))
    );
  }, [articles, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, Article[]>();
    for (const article of filtered) {
      const cat = article.category ?? 'General';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(article);
    }
    return map;
  }, [filtered]);

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 16px 48px' }}>
      {/* Hero */}
      <div
        style={{
          textAlign: 'center',
          padding: '48px 16px 36px',
        }}
      >
        <h1
          style={{
            fontSize: 32,
            fontWeight: 700,
            color: '#1e293b',
            marginBottom: 8,
          }}
        >
          Knowledge Base
        </h1>
        <p style={{ color: '#64748b', marginBottom: 24, fontSize: 16 }}>
          Browse articles, guides, and FAQs to find the answers you need.
        </p>
        <input
          type="text"
          placeholder="Search articles..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: '100%',
            maxWidth: 480,
            padding: '10px 16px',
            borderRadius: 8,
            border: '1px solid #cbd5e1',
            fontSize: 15,
            outline: 'none',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          }}
        />
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', padding: 64 }}>
          <span
            className="material-icons"
            style={{
              fontSize: 40,
              color: '#94a3b8',
              animation: 'spin 1s linear infinite',
            }}
          >
            autorenew
          </span>
          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Empty state */}
      {!loading && filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: 64, color: '#94a3b8' }}>
          <span className="material-icons" style={{ fontSize: 56, display: 'block', marginBottom: 12 }}>
            library_books
          </span>
          <p style={{ fontSize: 16 }}>
            {search ? 'No articles match your search.' : 'No articles published yet.'}
          </p>
        </div>
      )}

      {/* Categories */}
      {!loading &&
        Array.from(grouped.entries()).map(([category, arts]) => (
          <div key={category} style={{ marginBottom: 40 }}>
            <h2
              style={{
                fontSize: 18,
                fontWeight: 600,
                color: '#334155',
                marginBottom: 16,
                paddingBottom: 8,
                borderBottom: '2px solid #e2e8f0',
              }}
            >
              {category}
            </h2>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
                gap: 16,
              }}
            >
              {arts.map((article) => (
                <div
                  key={article.id}
                  onClick={() => navigate(`/kb/${article.slug}`)}
                  style={{
                    background: '#fff',
                    border: '1px solid #e2e8f0',
                    borderRadius: 10,
                    padding: '20px 20px 16px',
                    cursor: 'pointer',
                    transition: 'box-shadow 0.15s, border-color 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLDivElement).style.boxShadow =
                      '0 4px 16px rgba(0,0,0,0.10)';
                    (e.currentTarget as HTMLDivElement).style.borderColor = '#93c5fd';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
                    (e.currentTarget as HTMLDivElement).style.borderColor = '#e2e8f0';
                  }}
                >
                  <h3
                    style={{
                      fontSize: 15,
                      fontWeight: 600,
                      color: '#1e40af',
                      marginBottom: 6,
                    }}
                  >
                    {article.title}
                  </h3>
                  {article.excerpt && (
                    <p
                      style={{
                        fontSize: 13,
                        color: '#64748b',
                        marginBottom: 12,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {article.excerpt}
                    </p>
                  )}
                  {/* Tags */}
                  {article.tags.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
                      {article.tags.map((tag) => (
                        <span
                          key={tag}
                          style={{
                            fontSize: 11,
                            background: '#eff6ff',
                            color: '#3b82f6',
                            borderRadius: 4,
                            padding: '2px 7px',
                            fontWeight: 500,
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  {/* Stats */}
                  <div style={{ display: 'flex', gap: 14, color: '#94a3b8', fontSize: 12 }}>
                    <span>
                      <span className="material-icons" style={{ fontSize: 13, verticalAlign: 'middle', marginRight: 2 }}>
                        visibility
                      </span>
                      {article.viewCount}
                    </span>
                    <span>
                      <span className="material-icons" style={{ fontSize: 13, verticalAlign: 'middle', marginRight: 2 }}>
                        thumb_up
                      </span>
                      {article.helpfulCount}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
    </div>
  );
}
