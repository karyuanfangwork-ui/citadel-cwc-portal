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
    const articles = response.data?.data?.articles;
    if (!Array.isArray(articles)) return [];
    return articles.map((a: any) => ({
      ...a,
      tags: Array.isArray(a.tags) ? a.tags : [],
    }));
  },
  async getArticleBySlug(slug: string): Promise<Article> {
    const response = await api.get(`/kb/articles/${slug}`);
    const article = response.data?.data;
    if (article) {
      article.tags = Array.isArray(article.tags) ? article.tags : [];
    }
    return article;
  },
  async markHelpful(id: string, helpful: boolean): Promise<void> {
    await api.post(`/kb/articles/${id}/helpful`, { helpful });
  },
};

export default kbService;
