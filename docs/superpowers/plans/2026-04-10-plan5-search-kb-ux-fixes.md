# Plan 5: Search, KB Frontend & UX Fixes

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the header search bar to the existing `/search` API, build a Knowledge Base browse/search page, and fix key UX issues (confirmation dialogs, breadcrumbs, install Tailwind via npm).

**Architecture:** Connect existing search API to a new search results page. Build KB page using existing `/kb/articles` endpoints. Replace CDN Tailwind with npm package. Add confirmation utility for destructive actions.

**Tech Stack:** React, Tailwind CSS (npm), Vite, Axios

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `frontend/src/services/search.service.ts` | Search API client |
| Create | `frontend/pages/SearchResults.tsx` | Search results page |
| Create | `frontend/src/services/kb.service.ts` | Knowledge Base API client |
| Create | `frontend/pages/KnowledgeBase.tsx` | KB browse and search page |
| Create | `frontend/pages/ArticleDetail.tsx` | Single article view |
| Modify | `frontend/App.tsx` | Wire search form, add KB + search routes |
| Modify | `frontend/index.html` | Remove Tailwind CDN script |
| Modify | `frontend/package.json` | Add tailwindcss as dependency |
| Create | `frontend/tailwind.config.js` | Tailwind config |
| Create | `frontend/postcss.config.js` | PostCSS config |

---

### Task 1: Install Tailwind CSS via npm

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/tailwind.config.js`
- Create: `frontend/postcss.config.js`
- Modify: `frontend/index.html`

- [ ] **Step 1: Install Tailwind and its dependencies**

Run: `cd frontend && npm install -D tailwindcss @tailwindcss/forms postcss autoprefixer`

- [ ] **Step 2: Create `frontend/tailwind.config.js`**

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
    './pages/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Manrope', 'sans-serif'],
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
};
```

- [ ] **Step 3: Create `frontend/postcss.config.js`**

```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 4: Add Tailwind directives to the CSS file**

Create or update `frontend/index.css` to start with:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 5: Remove the Tailwind CDN `<script>` from `frontend/index.html`**

Remove this line:

```html
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
```

The existing `<link rel="stylesheet" href="/index.css">` will now load the npm-compiled Tailwind.

- [ ] **Step 6: Verify frontend builds**

Run: `cd frontend && npm run build`
Expected: Successful build with no missing class warnings

- [ ] **Step 7: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/tailwind.config.js frontend/postcss.config.js frontend/index.css frontend/index.html
git commit -m "feat: migrate Tailwind CSS from CDN to npm dependency"
```

---

### Task 2: Search Service & Results Page

**Files:**
- Create: `frontend/src/services/search.service.ts`
- Create: `frontend/pages/SearchResults.tsx`

- [ ] **Step 1: Create `frontend/src/services/search.service.ts`**

```typescript
import api from './api';

export interface SearchResult {
  type: 'request' | 'article' | 'user';
  id: string;
  title: string;
  excerpt: string;
  url: string;
  meta?: Record<string, string>;
}

const searchService = {
  async search(query: string): Promise<SearchResult[]> {
    const response = await api.get(`/search?q=${encodeURIComponent(query)}`);
    return response.data.data ?? [];
  },

  async searchRequests(query: string): Promise<SearchResult[]> {
    const response = await api.get(`/search/requests?q=${encodeURIComponent(query)}`);
    return response.data.data ?? [];
  },

  async searchArticles(query: string): Promise<SearchResult[]> {
    const response = await api.get(`/search/articles?q=${encodeURIComponent(query)}`);
    return response.data.data ?? [];
  },
};

export default searchService;
```

- [ ] **Step 2: Create `frontend/pages/SearchResults.tsx`**

```tsx
import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import searchService, { SearchResult } from '../src/services/search.service';

export default function SearchResults() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const query = searchParams.get('q') ?? '';
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!query) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    searchService
      .search(query)
      .then(setResults)
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  }, [query]);

  const typeIcons: Record<string, string> = {
    request: 'confirmation_number',
    article: 'article',
    user: 'person',
  };

  return (
    <div className="max-w-[900px] mx-auto px-6 py-8">
      <h1 className="text-2xl font-bold text-[#101418] mb-2">Search Results</h1>
      <p className="text-sm text-[#5e718d] mb-6">
        {loading ? 'Searching...' : `${results.length} result${results.length !== 1 ? 's' : ''} for "${query}"`}
      </p>

      {loading && (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0052cc]" />
        </div>
      )}

      {!loading && results.length === 0 && query && (
        <div className="text-center py-12 text-[#5e718d]">
          <span className="material-symbols-outlined text-5xl mb-3 block">search_off</span>
          <p className="font-semibold">No results found</p>
          <p className="text-sm mt-1">Try different keywords or check your spelling</p>
        </div>
      )}

      {!loading &&
        results.map((result) => (
          <div
            key={`${result.type}-${result.id}`}
            onClick={() => {
              if (result.type === 'request') navigate(`/request/${result.id}`);
              else if (result.type === 'article') navigate(`/kb/${result.id}`);
            }}
            className="bg-white border border-gray-200 rounded-lg p-4 mb-3 cursor-pointer hover:border-[#0052cc] hover:shadow-sm transition-all"
          >
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-[#5e718d] mt-0.5">
                {typeIcons[result.type] ?? 'description'}
              </span>
              <div>
                <span className="text-xs font-medium text-[#5e718d] uppercase">{result.type}</span>
                <h3 className="text-sm font-semibold text-[#101418] mt-0.5">{result.title}</h3>
                <p className="text-sm text-[#5e718d] mt-1 line-clamp-2">{result.excerpt}</p>
              </div>
            </div>
          </div>
        ))}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/services/search.service.ts frontend/pages/SearchResults.tsx
git commit -m "feat: add search service and search results page"
```

---

### Task 3: Knowledge Base Service & Pages

**Files:**
- Create: `frontend/src/services/kb.service.ts`
- Create: `frontend/pages/KnowledgeBase.tsx`
- Create: `frontend/pages/ArticleDetail.tsx`

- [ ] **Step 1: Create `frontend/src/services/kb.service.ts`**

```typescript
import api from './api';

export interface Article {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  category: string | null;
  tags: string[];
  viewCount: number;
  helpfulCount: number;
  notHelpfulCount: number;
  isPublished: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  author?: { firstName: string; lastName: string };
}

const kbService = {
  async getArticles(): Promise<Article[]> {
    const response = await api.get('/kb/articles');
    return response.data.data ?? [];
  },

  async getArticleBySlug(slug: string): Promise<Article> {
    const response = await api.get(`/kb/articles/${slug}`);
    return response.data.data;
  },

  async markHelpful(id: string, helpful: boolean): Promise<void> {
    await api.post(`/kb/articles/${id}/helpful`, { helpful });
  },
};

export default kbService;
```

- [ ] **Step 2: Create `frontend/pages/KnowledgeBase.tsx`**

```tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import kbService, { Article } from '../src/services/kb.service';

export default function KnowledgeBase() {
  const navigate = useNavigate();
  const [articles, setArticles] = useState<Article[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    kbService
      .getArticles()
      .then(setArticles)
      .catch(() => setArticles([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = searchTerm
    ? articles.filter(
        (a) =>
          a.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (a.excerpt ?? '').toLowerCase().includes(searchTerm.toLowerCase()) ||
          a.tags.some((t) => t.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    : articles;

  // Group by category
  const categories = [...new Set(filtered.map((a) => a.category ?? 'General'))];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0052cc]" />
      </div>
    );
  }

  return (
    <div className="max-w-[1100px] mx-auto px-6 py-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-[#101418] mb-3">Knowledge Base</h1>
        <p className="text-[#5e718d] mb-6">Find answers to common questions and guides</p>
        <div className="max-w-lg mx-auto relative">
          <span className="material-symbols-outlined absolute left-3 top-3 text-[#5e718d]">search</span>
          <input
            type="text"
            placeholder="Search articles..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#0052cc] focus:border-transparent"
          />
        </div>
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-[#5e718d]">
          <span className="material-symbols-outlined text-5xl mb-3 block">library_books</span>
          <p className="font-semibold">{searchTerm ? 'No articles match your search' : 'No articles published yet'}</p>
        </div>
      )}

      {categories.map((category) => (
        <div key={category} className="mb-8">
          <h2 className="text-lg font-semibold text-[#101418] mb-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-[#0052cc]">folder</span>
            {category}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered
              .filter((a) => (a.category ?? 'General') === category)
              .map((article) => (
                <div
                  key={article.id}
                  onClick={() => navigate(`/kb/${article.slug}`)}
                  className="bg-white border border-gray-200 rounded-xl p-5 cursor-pointer hover:border-[#0052cc] hover:shadow-sm transition-all"
                >
                  <h3 className="font-semibold text-[#101418] mb-2">{article.title}</h3>
                  <p className="text-sm text-[#5e718d] line-clamp-2 mb-3">{article.excerpt ?? ''}</p>
                  <div className="flex items-center gap-4 text-xs text-[#8899aa]">
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">visibility</span>
                      {article.viewCount}
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">thumb_up</span>
                      {article.helpfulCount}
                    </span>
                    {article.tags.length > 0 && (
                      <span>{article.tags.slice(0, 3).join(', ')}</span>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Create `frontend/pages/ArticleDetail.tsx`**

```tsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import kbService, { Article } from '../src/services/kb.service';

export default function ArticleDetail() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [voted, setVoted] = useState<boolean | null>(null);

  useEffect(() => {
    if (!slug) return;
    kbService
      .getArticleBySlug(slug)
      .then(setArticle)
      .catch(() => setArticle(null))
      .finally(() => setLoading(false));
  }, [slug]);

  async function handleVote(helpful: boolean) {
    if (!article || voted !== null) return;
    await kbService.markHelpful(article.id, helpful);
    setVoted(helpful);
    setArticle((prev) =>
      prev
        ? {
            ...prev,
            helpfulCount: helpful ? prev.helpfulCount + 1 : prev.helpfulCount,
            notHelpfulCount: helpful ? prev.notHelpfulCount : prev.notHelpfulCount + 1,
          }
        : prev
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0052cc]" />
      </div>
    );
  }

  if (!article) {
    return (
      <div className="max-w-[800px] mx-auto px-6 py-12 text-center text-[#5e718d]">
        <span className="material-symbols-outlined text-5xl mb-3 block">error</span>
        <p className="font-semibold">Article not found</p>
        <button onClick={() => navigate('/kb')} className="mt-4 text-[#0052cc] hover:underline">
          Back to Knowledge Base
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-[800px] mx-auto px-6 py-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-[#5e718d] mb-6">
        <button onClick={() => navigate('/kb')} className="hover:text-[#0052cc]">Knowledge Base</button>
        <span>/</span>
        {article.category && (
          <>
            <span>{article.category}</span>
            <span>/</span>
          </>
        )}
        <span className="text-[#101418]">{article.title}</span>
      </div>

      <h1 className="text-2xl font-bold text-[#101418] mb-4">{article.title}</h1>

      <div className="flex items-center gap-4 text-sm text-[#5e718d] mb-6">
        {article.author && (
          <span>By {article.author.firstName} {article.author.lastName}</span>
        )}
        <span>{new Date(article.updatedAt).toLocaleDateString()}</span>
        <span className="flex items-center gap-1">
          <span className="material-symbols-outlined text-sm">visibility</span>
          {article.viewCount} views
        </span>
      </div>

      {article.tags.length > 0 && (
        <div className="flex gap-2 mb-6">
          {article.tags.map((tag) => (
            <span key={tag} className="text-xs bg-gray-100 text-[#5e718d] px-2 py-1 rounded-full">{tag}</span>
          ))}
        </div>
      )}

      <div className="prose max-w-none text-[#101418] leading-relaxed mb-8 whitespace-pre-wrap">
        {article.content}
      </div>

      {/* Helpful? */}
      <div className="border-t border-gray-200 pt-6">
        <p className="text-sm font-semibold text-[#101418] mb-3">Was this article helpful?</p>
        {voted === null ? (
          <div className="flex gap-3">
            <button
              onClick={() => handleVote(true)}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-green-50 hover:border-green-300 transition-colors"
            >
              <span className="material-symbols-outlined text-sm">thumb_up</span>
              Yes ({article.helpfulCount})
            </button>
            <button
              onClick={() => handleVote(false)}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-red-50 hover:border-red-300 transition-colors"
            >
              <span className="material-symbols-outlined text-sm">thumb_down</span>
              No ({article.notHelpfulCount})
            </button>
          </div>
        ) : (
          <p className="text-sm text-green-600">Thanks for your feedback!</p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/services/kb.service.ts frontend/pages/KnowledgeBase.tsx frontend/pages/ArticleDetail.tsx
git commit -m "feat: add Knowledge Base browse page and article detail with voting"
```

---

### Task 4: Wire Search & KB into App Router

**Files:**
- Modify: `frontend/App.tsx`

- [ ] **Step 1: Add imports**

```typescript
import SearchResults from './pages/SearchResults';
import KnowledgeBase from './pages/KnowledgeBase';
import ArticleDetail from './pages/ArticleDetail';
```

- [ ] **Step 2: Add routes**

```tsx
<Route path="/search" element={<ProtectedRoute><SearchResults /></ProtectedRoute>} />
<Route path="/kb" element={<ProtectedRoute><KnowledgeBase /></ProtectedRoute>} />
<Route path="/kb/:slug" element={<ProtectedRoute><ArticleDetail /></ProtectedRoute>} />
```

- [ ] **Step 3: Wire the header search form**

Replace the existing search input (around lines 54-61) with a form that navigates to the search page:

```tsx
<form
  onSubmit={(e) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const q = formData.get('q') as string;
    if (q.trim()) {
      window.location.hash = `#/search?q=${encodeURIComponent(q.trim())}`;
    }
  }}
  className="hidden md:flex flex-1 max-w-md"
>
  <div className="relative w-full">
    <span className="material-symbols-outlined absolute left-3 top-2.5 text-[#5e718d] text-xl">search</span>
    <input
      name="q"
      type="text"
      placeholder="Search requests and articles..."
      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#0052cc] focus:border-transparent bg-[#e8edf2]"
    />
  </div>
</form>
```

- [ ] **Step 4: Update KB nav link to point to /kb**

Change the existing "Knowledge Base" link href from wherever it currently points to:

```tsx
<a href="#/kb" className="text-[#0e141b] text-sm font-medium">Knowledge Base</a>
```

- [ ] **Step 5: Verify frontend builds**

Run: `cd frontend && npm run build`

- [ ] **Step 6: Commit**

```bash
git add frontend/App.tsx
git commit -m "feat: wire search form and KB routes into app"
```

---

## Summary

After completing all 4 tasks:
- Tailwind CSS is installed via npm (no CDN dependency, tree-shaking enabled)
- Header search bar submits to `/search?q=...` which queries the existing `/api/v1/search` endpoint
- Search results page shows requests, articles, and users with type indicators
- Knowledge Base page lets users browse published articles grouped by category
- Article detail page shows content, metadata, tags, and helpful/not-helpful voting
- Breadcrumb navigation on article pages
