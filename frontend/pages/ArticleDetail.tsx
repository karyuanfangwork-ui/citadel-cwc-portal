import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import kbService, { Article } from '../src/services/kb.service';

export default function ArticleDetail() {
  const { slug } = useParams<{ slug: string }>();
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [voted, setVoted] = useState(false);
  const [helpfulCount, setHelpfulCount] = useState(0);
  const [notHelpfulCount, setNotHelpfulCount] = useState(0);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    kbService
      .getArticleBySlug(slug)
      .then((data) => {
        setArticle(data);
        setHelpfulCount(data.helpfulCount);
        setNotHelpfulCount(data.notHelpfulCount);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug]);

  const handleVote = async (helpful: boolean) => {
    if (!article || voted) return;
    try {
      await kbService.markHelpful(article.id, helpful);
      if (helpful) setHelpfulCount((c) => c + 1);
      else setNotHelpfulCount((c) => c + 1);
      setVoted(true);
    } catch {
      // ignore
    }
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

  /* ---- Loading ---- */
  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <span
          className="material-icons"
          style={{
            fontSize: 40,
            color: '#94a3b8',
            animation: 'spin 1s linear infinite',
            display: 'block',
            margin: '0 auto',
          }}
        >
          autorenew
        </span>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  /* ---- 404 ---- */
  if (notFound || !article) {
    return (
      <div style={{ textAlign: 'center', padding: 80, color: '#64748b' }}>
        <span className="material-icons" style={{ fontSize: 56, display: 'block', marginBottom: 12, color: '#cbd5e1' }}>
          article
        </span>
        <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 8, color: '#1e293b' }}>
          Article Not Found
        </h2>
        <p style={{ marginBottom: 20 }}>The article you're looking for does not exist or has been removed.</p>
        <Link
          to="/kb"
          style={{
            display: 'inline-block',
            padding: '8px 20px',
            background: '#3b82f6',
            color: '#fff',
            borderRadius: 6,
            textDecoration: 'none',
            fontWeight: 500,
          }}
        >
          Back to Knowledge Base
        </Link>
      </div>
    );
  }

  const category = article.category ?? 'General';
  const authorName = article.author
    ? `${article.author.firstName} ${article.author.lastName}`
    : 'Unknown Author';

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 16px 64px' }}>
      {/* Breadcrumb */}
      <nav style={{ fontSize: 13, color: '#94a3b8', marginBottom: 20, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <Link to="/kb" style={{ color: '#3b82f6', textDecoration: 'none' }}>
          Knowledge Base
        </Link>
        <span className="material-icons" style={{ fontSize: 14 }}>chevron_right</span>
        <span style={{ color: '#64748b' }}>{category}</span>
        <span className="material-icons" style={{ fontSize: 14 }}>chevron_right</span>
        <span style={{ color: '#334155', fontWeight: 500 }}>{article.title}</span>
      </nav>

      {/* Article card */}
      <div
        style={{
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: 12,
          padding: '32px 36px',
        }}
      >
        {/* Title */}
        <h1 style={{ fontSize: 26, fontWeight: 700, color: '#1e293b', marginBottom: 12 }}>
          {article.title}
        </h1>

        {/* Meta */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 16,
            fontSize: 13,
            color: '#64748b',
            marginBottom: 16,
            paddingBottom: 16,
            borderBottom: '1px solid #f1f5f9',
          }}
        >
          <span>
            <span className="material-icons" style={{ fontSize: 14, verticalAlign: 'middle', marginRight: 4 }}>
              person
            </span>
            {authorName}
          </span>
          {article.publishedAt && (
            <span>
              <span className="material-icons" style={{ fontSize: 14, verticalAlign: 'middle', marginRight: 4 }}>
                calendar_today
              </span>
              {formatDate(article.publishedAt)}
            </span>
          )}
          <span>
            <span className="material-icons" style={{ fontSize: 14, verticalAlign: 'middle', marginRight: 4 }}>
              visibility
            </span>
            {article.viewCount} views
          </span>
        </div>

        {/* Tags */}
        {article.tags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
            {article.tags.map((tag) => (
              <span
                key={tag}
                style={{
                  fontSize: 12,
                  background: '#eff6ff',
                  color: '#3b82f6',
                  borderRadius: 4,
                  padding: '3px 9px',
                  fontWeight: 500,
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Content */}
        <div
          style={{
            fontSize: 15,
            lineHeight: 1.75,
            color: '#334155',
            whiteSpace: 'pre-wrap',
            marginBottom: 32,
          }}
        >
          {article.content}
        </div>

        {/* Voting */}
        <div
          style={{
            borderTop: '1px solid #f1f5f9',
            paddingTop: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <span style={{ fontSize: 14, color: '#475569', fontWeight: 500 }}>
            Was this helpful?
          </span>
          <button
            onClick={() => handleVote(true)}
            disabled={voted}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '6px 14px',
              borderRadius: 6,
              border: '1px solid #cbd5e1',
              background: voted ? '#f8fafc' : '#fff',
              color: voted ? '#94a3b8' : '#16a34a',
              cursor: voted ? 'default' : 'pointer',
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            <span className="material-icons" style={{ fontSize: 16 }}>thumb_up</span>
            Yes ({helpfulCount})
          </button>
          <button
            onClick={() => handleVote(false)}
            disabled={voted}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '6px 14px',
              borderRadius: 6,
              border: '1px solid #cbd5e1',
              background: voted ? '#f8fafc' : '#fff',
              color: voted ? '#94a3b8' : '#dc2626',
              cursor: voted ? 'default' : 'pointer',
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            <span className="material-icons" style={{ fontSize: 16 }}>thumb_down</span>
            No ({notHelpfulCount})
          </button>
          {voted && (
            <span style={{ fontSize: 13, color: '#64748b', fontStyle: 'italic' }}>
              Thank you for your feedback!
            </span>
          )}
        </div>
      </div>

      {/* Back link */}
      <div style={{ marginTop: 20 }}>
        <Link
          to="/kb"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 13,
            color: '#3b82f6',
            textDecoration: 'none',
          }}
        >
          <span className="material-icons" style={{ fontSize: 16 }}>arrow_back</span>
          Back to Knowledge Base
        </Link>
      </div>
    </div>
  );
}
