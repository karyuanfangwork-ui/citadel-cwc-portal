import { beforeEach, describe, expect, it, vi } from 'vitest';

const { post } = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock('../api', () => ({ default: { post } }));

import { batchUploadDocs } from '../approval.service';

describe('batchUploadDocs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    post.mockResolvedValue({ data: { data: [] } });
  });

  it('allows enough time for sequential storage of the three required files', async () => {
    const files = [
      { file: new File(['resume'], 'resume.pdf', { type: 'application/pdf' }), documentType: 'RESUME' },
      { file: new File(['certificate'], 'certificate.pdf', { type: 'application/pdf' }), documentType: 'CERTIFICATE' },
      { file: new File(['transcript'], 'transcript.pdf', { type: 'application/pdf' }), documentType: 'TRANSCRIPT' },
    ];

    await batchUploadDocs('request-1', files, 'Sam Lee');

    expect(post).toHaveBeenCalledWith(
      '/approvals/requests/request-1/upload-candidate-docs',
      expect.any(FormData),
      expect.objectContaining({ timeout: 120000 }),
    );
  });
});
