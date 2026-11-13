import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import BatchUploadModal from '../BatchUploadModal';

const { batchUploadDocs, getCandidates, toastSuccess } = vi.hoisted(() => ({
  batchUploadDocs: vi.fn(),
  getCandidates: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock('../../../services/approval.service', () => ({ batchUploadDocs, getCandidates }));
vi.mock('../../../context/ToastContext', () => ({ useToast: () => ({ success: toastSuccess, error: vi.fn() }) }));

function selectThreeFiles(container: HTMLElement) {
  const inputs = container.ownerDocument.body.querySelectorAll('input[type="file"]');
  const files = [
    new File(['resume'], 'resume.pdf', { type: 'application/pdf' }),
    new File(['certificate'], 'certificate.pdf', { type: 'application/pdf' }),
    new File(['transcript'], 'transcript.pdf', { type: 'application/pdf' }),
  ];
  inputs.forEach((input, index) => fireEvent.change(input, { target: { files: [files[index]] } }));
  return files;
}

describe('BatchUploadModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    batchUploadDocs.mockResolvedValue([]);
    getCandidates.mockResolvedValue([]);
  });

  it('confirms a successful batch and calls the close/refresh callback', async () => {
    const onSuccess = vi.fn();
    const onClose = vi.fn();
    const { container } = render(
      <BatchUploadModal requestId="request-1" onSuccess={onSuccess} onClose={onClose} />,
    );
    const files = selectThreeFiles(container);
    fireEvent.change(screen.getByPlaceholderText('e.g., John Doe'), { target: { value: 'Sam Lee' } });
    fireEvent.click(screen.getByRole('button', { name: 'Upload 3 Documents' }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(batchUploadDocs).toHaveBeenCalledWith(
      'request-1',
      files.map((file, index) => ({ file, documentType: ['RESUME', 'CERTIFICATE', 'TRANSCRIPT'][index] })),
      'Sam Lee',
      undefined,
      undefined,
    );
    expect(toastSuccess).toHaveBeenCalledWith('Documents uploaded', '3 documents for Sam Lee were saved.');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('verifies committed documents after a lost upload response instead of asking for a duplicate retry', async () => {
    batchUploadDocs.mockRejectedValue(new Error('timeout'));
    getCandidates.mockResolvedValue([{
      id: 'candidate-1',
      fullName: 'Sam Lee',
      documents: [
        { id: 'doc-1', documentType: 'RESUME', fileName: 'resume.pdf' },
        { id: 'doc-2', documentType: 'CERTIFICATE', fileName: 'certificate.pdf' },
        { id: 'doc-3', documentType: 'TRANSCRIPT', fileName: 'transcript.pdf' },
      ],
    }]);
    const onSuccess = vi.fn();
    const onClose = vi.fn();
    const { container } = render(
      <BatchUploadModal requestId="request-1" onSuccess={onSuccess} onClose={onClose} />,
    );
    selectThreeFiles(container);
    fireEvent.change(screen.getByPlaceholderText('e.g., John Doe'), { target: { value: 'Sam Lee' } });
    fireEvent.click(screen.getByRole('button', { name: 'Upload 3 Documents' }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(getCandidates).toHaveBeenCalledWith('request-1');
    expect(toastSuccess).toHaveBeenCalledWith('Upload confirmed', 'All 3 documents for Sam Lee were saved.');
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('timeout')).not.toBeInTheDocument();
  });

  it('announces that a timed-out upload is being verified', async () => {
    batchUploadDocs.mockImplementation(() => new Promise(() => undefined));
    const { container } = render(
      <BatchUploadModal requestId="request-1" onSuccess={vi.fn()} onClose={vi.fn()} />,
    );
    selectThreeFiles(container);
    fireEvent.change(screen.getByPlaceholderText('e.g., John Doe'), { target: { value: 'Sam Lee' } });
    fireEvent.click(screen.getByRole('button', { name: 'Upload 3 Documents' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Uploading documents');
  });

  it('keeps the modal open with an error when the server did not save the batch', async () => {
    batchUploadDocs.mockRejectedValue({ response: { data: { message: 'Storage unavailable' } } });
    const onSuccess = vi.fn();
    const { container } = render(
      <BatchUploadModal requestId="request-1" onSuccess={onSuccess} onClose={vi.fn()} />,
    );
    selectThreeFiles(container);
    fireEvent.change(screen.getByPlaceholderText('e.g., John Doe'), { target: { value: 'Sam Lee' } });
    fireEvent.click(screen.getByRole('button', { name: 'Upload 3 Documents' }));

    expect(await screen.findByText('Storage unavailable')).toBeInTheDocument();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(toastSuccess).not.toHaveBeenCalled();
  });
});
