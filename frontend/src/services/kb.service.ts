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
