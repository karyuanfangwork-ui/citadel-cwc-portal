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
