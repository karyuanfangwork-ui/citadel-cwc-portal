import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import BureauUploadModal from '../BureauUploadModal';

const { uploadBorrowerDocument, createBorrowerBureauReport } = vi.hoisted(() => ({
  uploadBorrowerDocument: vi.fn().mockResolvedValue({ fileName: 'ctos-report.pdf', filePath: 'borrowers/borrower-1/ctos-report.pdf' }),
  createBorrowerBureauReport: vi.fn().mockResolvedValue({ id: 'report-1', borrowerId: 'borrower-1', source: 'CTOS', uploadedAt: '2026-08-20T00:00:00.000Z' }),
}));

vi.mock('../../../../services/credit.service', () => ({
  default: { uploadBorrowerDocument, createBorrowerBureauReport },
}));

vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

describe('BureauUploadModal', () => {
  it('requires a real file and bureau score before saving', () => {
    render(<BureauUploadModal borrowerId="borrower-1" open onClose={vi.fn()} onSaved={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Save Report' }));

    expect(screen.getByText('Select the bureau report file before saving.')).toBeVisible();
    expect(uploadBorrowerDocument).not.toHaveBeenCalled();
    expect(createBorrowerBureauReport).not.toHaveBeenCalled();
  });

  it('uploads the report, records its score, and saves the linked report metadata', async () => {
    render(<BureauUploadModal borrowerId="borrower-1" open onClose={vi.fn()} onSaved={vi.fn()} />);

    const file = new File(['bureau report'], 'ctos-report.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByLabelText('Report file'), { target: { files: [file] } });
    fireEvent.change(screen.getByLabelText('Bureau credit score'), { target: { value: '720' } });
    fireEvent.change(screen.getByLabelText('Report date'), { target: { value: '2026-08-20' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Report' }));

    await waitFor(() => expect(uploadBorrowerDocument).toHaveBeenCalledWith('borrower-1', file, 'CREDIT_BUREAU_REPORT'));
    expect(createBorrowerBureauReport).toHaveBeenCalledWith('borrower-1', expect.objectContaining({
      source: 'CTOS',
      creditScore: 720,
      fileName: 'ctos-report.pdf',
      filePath: 'borrowers/borrower-1/ctos-report.pdf',
    }));
  });
});
