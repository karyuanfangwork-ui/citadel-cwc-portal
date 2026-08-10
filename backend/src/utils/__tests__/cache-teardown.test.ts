/**
 * Phase 8b: the cache module owns a Redis client outside the shared registry.
 */
describe('Phase 8b: cache Redis client is closable', () => {
  it('exports closeCacheRedis', async () => {
    const cache = await import('../cache');
    expect(typeof cache.closeCacheRedis).toBe('function');
  });

  it('closeCacheRedis is safe to call when no client was ever created', async () => {
    const { closeCacheRedis } = await import('../cache');
    await expect(closeCacheRedis()).resolves.toBeUndefined();
  });

  it('closeCacheRedis releases the client so a later call re-creates it', async () => {
    const { cacheGet, closeCacheRedis } = await import('../cache');
    await cacheGet('phase8b:probe');
    await closeCacheRedis();
    await expect(cacheGet('phase8b:probe')).resolves.toBeDefined();
    await closeCacheRedis();
  });
});
