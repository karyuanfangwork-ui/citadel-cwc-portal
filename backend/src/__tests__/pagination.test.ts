import { parsePagination } from '../utils/pagination';

describe('parsePagination', () => {
  it('defaults to page 1 and limit 20', () => {
    expect(parsePagination({})).toEqual({ page: 1, limit: 20, skip: 0 });
  });

  it('caps limit at 100', () => {
    expect(parsePagination({ page: '2', limit: '999999' })).toEqual({
      page: 2,
      limit: 100,
      skip: 100,
    });
  });

  it('supports a stricter endpoint-specific maximum', () => {
    expect(parsePagination({ page: '3', limit: '999999' }, 50)).toEqual({
      page: 3,
      limit: 50,
      skip: 100,
    });
  });

  it('normalizes invalid values', () => {
    expect(parsePagination({ page: '-1', limit: 'abc' })).toEqual({
      page: 1,
      limit: 20,
      skip: 0,
    });
  });
});
