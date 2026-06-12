import { z } from 'zod';
import { validate } from '../middleware/validate.middleware';

const runMiddleware = async (req: any, schema: any) => {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };
  const next = jest.fn();
  await validate(schema)(req, res as any, next);
  return { req, res, next };
};

describe('validate middleware', () => {
  it('replaces req.body/query/params with parsed Zod output', async () => {
    const schema = z.object({
      body: z.object({
        limit: z.coerce.number().int(),
      }),
      query: z.object({
        page: z.coerce.number().int().default(1),
      }),
      params: z.object({
        id: z.string().uuid(),
      }),
    });

    const req = {
      body: { limit: '25', attackerField: 'strip-me' },
      query: {},
      params: { id: '11111111-1111-4111-8111-111111111111' },
    };

    const { next } = await runMiddleware(req, schema);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.body).toEqual({ limit: 25 });
    expect(req.query).toEqual({ page: 1 });
    expect(req.params).toEqual({ id: '11111111-1111-4111-8111-111111111111' });
  });
});
