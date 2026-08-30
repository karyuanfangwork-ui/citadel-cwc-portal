import { createWebhookSchema } from '../webhook.routes';

describe('webhook admin route validator', () => {
  const valid = {
    name: 'Core events',
    url: 'https://example.test/webhooks/credit',
    secret: '0123456789abcdef',
    events: ['credit.application.updated'],
    maxRetries: 3,
    retryDelaySec: 60,
  };

  it('accepts a bounded subscription payload', () => {
    expect(createWebhookSchema.safeParse({ body: valid }).success).toBe(true);
  });

  it.each([
    { url: 'not-a-url' },
    { events: [] },
    { maxRetries: 11 },
    { retryDelaySec: 0 },
    { secret: 'short' },
  ])('rejects invalid subscription input: %j', (override) => {
    expect(createWebhookSchema.safeParse({ body: { ...valid, ...override } }).success).toBe(false);
  });
});
