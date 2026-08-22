import { AppError } from '../../middleware/error.middleware';
import {
  createStatusDefinition,
  deleteStatusDefinition,
  normalizeStatusCode,
  updateStatusDefinition,
} from '../requestStatusDefinition.service';

describe('requestStatusDefinition.service', () => {
  it('normalizes and validates status codes', () => {
    expect(normalizeStatusCode(' finance_review ')).toBe('FINANCE_REVIEW');
    expect(() => normalizeStatusCode('1_INVALID')).toThrow(AppError);
    expect(() => normalizeStatusCode('bad-code')).toThrow(AppError);
  });

  it('creates a normalized dynamic status definition', async () => {
    const client = {
      requestStatusDefinition: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: '1', code: 'FINANCE_REVIEW', label: 'Finance Review' }),
      },
    };
    await createStatusDefinition({ code: ' finance_review ', label: ' Finance Review ', lifecycleType: 'OPEN' }, client);
    expect(client.requestStatusDefinition.create).toHaveBeenCalledWith({ data: expect.objectContaining({ code: 'FINANCE_REVIEW', label: 'Finance Review' }) });
  });

  it('rejects code renames and deletes with references', async () => {
    const client = {
      requestStatusDefinition: {
        findUnique: jest.fn().mockResolvedValue({ id: '1', code: 'OLD_STATUS', label: 'Old', lifecycleType: 'OPEN', isActive: true, retiredAt: null, category: null, description: null, displayOrder: 0 }),
        update: jest.fn(),
        delete: jest.fn(),
      },
      workflowNode: { count: jest.fn().mockResolvedValue(1) },
      workflowStep: { count: jest.fn().mockResolvedValue(0) },
      workflowTransition: { count: jest.fn().mockResolvedValue(0) },
      request: { count: jest.fn().mockResolvedValue(0) },
      workflowHistory: { count: jest.fn().mockResolvedValue(0) },
      bannerConfig: { count: jest.fn().mockResolvedValue(0) },
    };
    await expect(updateStatusDefinition('1', { code: 'NEW_STATUS', label: 'New' }, client)).rejects.toThrow('immutable');
    await expect(deleteStatusDefinition('1', client)).rejects.toThrow('retire it instead');
  });
});
