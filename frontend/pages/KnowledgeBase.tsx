import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Breadcrumbs from '../src/components/Breadcrumbs';
import kbService, { Article } from '../src/services/kb.service';
import { friendlyMessage } from '../src/utils/errorMessages';

export default function KnowledgeBase() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    kbService
      .getArticles()
      .then(setArticles)
      .catch((err) => setError(friendlyMessage(err, 'Unable to load articles. Please try again.')))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return articles;
    return articles.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        (a.excerpt ?? '').toLowerCase().includes(q) ||
        a.tags?.some((t: string) => t.toLowerCase().includes(q))
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
    <div className="max-w-[1100px] mx-auto px-4 pb-12">
      {/* Breadcrumbs */}
      <Breadcrumbs items={[
        { label: 'Home', to: '/' },
        { label: 'Knowledge Base' },
      ]} />
      {/* Hero */}
      <div className="text-center py-12 px-4">
        <h1 className="text-[32px] font-bold text-brand-900 mb-2">
          Knowledge Base
        </h1>
        <p className="text-text-secondary mb-6 text-base">
          Browse articles, guides, and FAQs to find the answers you need.
        </p>
        <input
          type="text"
          placeholder="Search articles..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-[480px] py-2.5 px-4 rounded-lg border border-cwc-border text-[15px] outline-none shadow-cwc-sm focus:border-brand-700 focus:ring-1 focus:ring-brand-700"
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

      {/* Error */}
      {!loading && error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 px-5 rounded-lg mb-6">
          <p className="font-bold m-0">Error loading articles</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && filtered.length === 0 && (
        <div className="text-center py-16 text-slate-400">
          <span className="material-icons text-5xl block mb-3">
            library_books
          </span>
          <p className="text-base">
            {search ? 'No articles match your search.' : 'No articles published yet.'}
          </p>
        </div>
      )}

      {/* Categories */}
      {!loading &&
        Array.from(grouped.entries()).map(([category, arts]) => (
          <div key={category} className="mb-10">
            <h2 className="text-lg font-semibold text-brand-900 mb-4 pb-2 border-b-2 border-cwc-border">
              {category}
            </h2>
            <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' }}>
              {arts.map((article) => (
                <div
                  key={article.id}
                  onClick={() => navigate(`/kb/${article.slug}`)}
                  className="bg-white border border-cwc-border rounded-cwc-md p-5 pb-4 cursor-pointer transition-shadow duration-150"
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLDivElement).style.boxShadow =
                      '0 4px 16px rgba(0,0,0,0.10)';
                    (e.currentTarget as HTMLDivElement).style.borderColor = '#93c5fd';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
                    (e.currentTarget as HTMLDivElement).style.borderColor = '';
                  }}
                >
                  <h3 className="text-[15px] font-semibold text-brand-700 mb-1.5">
                    {article.title}
                  </h3>
                  {article.excerpt && (
                    <p
                      className="text-[13px] text-text-secondary mb-3 overflow-hidden"
                      style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}
                    >
                      {article.excerpt}
                    </p>
                  )}
                  {/* Tags */}
                  {article.tags && article.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2.5">
                      {article.tags.map((tag) => (
                        <span
                          key={tag}
                          className="text-[11px] bg-blue-50 text-blue-500 rounded py-0.5 px-1.5 font-medium"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  {/* Stats */}
                  <div className="flex gap-3.5 text-slate-400 text-xs">
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
