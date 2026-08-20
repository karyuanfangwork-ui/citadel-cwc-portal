import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mocks = vi.hoisted(() => ({
  getApplicationDraft: vi.fn(),
  getBorrowerProfile: vi.fn(),
  saveApplicationDraft: vi.fn(),
  deleteApplicationDraft: vi.fn(),
  listBorrowerProfiles: vi.fn(),
  listBranches: vi.fn(),
}));

vi.mock('../../../src/services/credit.service', () => ({
  default: {
    getApplicationDraft: mocks.getApplicationDraft,
    getBorrowerProfile: mocks.getBorrowerProfile,
    saveApplicationDraft: mocks.saveApplicationDraft,
    deleteApplicationDraft: mocks.deleteApplicationDraft,
    listBorrowerProfiles: mocks.listBorrowerProfiles,
  },
  branchApi: { list: mocks.listBranches },
  financialApi: { createStatement: vi.fn(), upsertLineItems: vi.fn(), computeRatios: vi.fn() },
  retailIncomeApi: { upsert: vi.fn() },
}));

vi.mock('../../../src/context/AuthContext', () => ({
  useAuth: () => ({ user: null }),
}));

vi.mock('react-hot-toast', () => ({
  default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

import CreditApplicationCreate from '../CreditApplicationCreate';

const borrower = {
  id: 'borrower-1',
  borrowerType: 'INDIVIDUAL',
  name: 'Ahmad bin Rahman',
  accountId: null,
  contactId: null,
  creditRiskRating: null,
  amlRiskTier: null,
  exposureLimit: null,
  totalExposure: null,
  isSanctionedEntity: false,
  sourceOfWealth: null,
  purposeOfAccount: null,
  occupation: null,
  employer: null,
  annualIncome: null,
  netWorth: null,
  nricPassport: '900101-10-1234',
  isActive: true,
  deletedAt: null,
  createdAt: '2026-08-20T00:00:00.000Z',
  updatedAt: '2026-08-20T00:00:00.000Z',
};

const manuallySelectedBorrower = {
  ...borrower,
  id: 'borrower-2',
  name: 'Manual borrower',
  nricPassport: '880202-10-4321',
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function renderCreate() {
  return render(
    <MemoryRouter initialEntries={['/credit/applications/new?borrowerId=borrower-1']}>
      <CreditApplicationCreate />
    </MemoryRouter>,
  );
}

async function openApplicantSelection() {
  fireEvent.click(screen.getByRole('button', { name: /Applicant Selection/i }));
  await screen.findByText('Selected applicant');
}

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  vi.clearAllMocks();
  mocks.getApplicationDraft.mockResolvedValue(null);
  mocks.getBorrowerProfile.mockResolvedValue(borrower);
  mocks.saveApplicationDraft.mockResolvedValue(undefined);
  mocks.deleteApplicationDraft.mockResolvedValue(undefined);
  mocks.listBorrowerProfiles.mockResolvedValue({ profiles: [], pagination: {} });
  mocks.listBranches.mockResolvedValue([]);
});

describe('CreditApplicationCreate borrower URL context', () => {
  it('hydrates the selected applicant card from the URL borrower', async () => {
    renderCreate();

    await openApplicantSelection();

    expect(screen.getByRole('heading', { name: 'Ahmad bin Rahman' })).toBeInTheDocument();
    expect(screen.getByText(/900101-10-1234/)).toBeInTheDocument();
    expect(screen.getByText('Borrower 360 context')).toBeInTheDocument();
  });

  it('keeps document upload metadata in the autosaved draft after context hydration', async () => {
    mocks.getApplicationDraft.mockResolvedValue({
      payload: {
        currentStep: 'documents',
        applicantMode: 'existing',
        documents: [{
          key: 'nric-front',
          label: 'NRIC Front',
          required: true,
          fileName: 'nric-front.jpg',
          uploadedDocumentId: 'document-1',
          completed: true,
        }],
      },
    });

    renderCreate();

    expect(await screen.findByText('Uploaded: nric-front.jpg')).toBeInTheDocument();
    await waitFor(() => expect(mocks.saveApplicationDraft).toHaveBeenCalled(), { timeout: 2000 });

    const savedDraft = mocks.saveApplicationDraft.mock.calls.at(-1)?.[0];
    expect(savedDraft.documents).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'nric-front', uploadedDocumentId: 'document-1' }),
    ]));
  });

  it('does not let a pending URL lookup replace a borrower selected by the user', async () => {
    const contextRequest = deferred<typeof borrower>();
    mocks.getBorrowerProfile.mockReturnValueOnce(contextRequest.promise);
    mocks.listBorrowerProfiles.mockResolvedValue({ profiles: [manuallySelectedBorrower], pagination: {} });

    renderCreate();

    await screen.findByText('Loading borrower opened from Borrower 360…');
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Manual' } });
    await screen.findByText('Manual borrower');
    fireEvent.click(screen.getByRole('button', { name: 'Use Existing Applicant' }));
    contextRequest.resolve(borrower);

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Manual borrower' })).toBeInTheDocument());
    expect(screen.queryByText('Borrower 360 context')).not.toBeInTheDocument();
  });

  it('shows a retry control from a later wizard step when the URL borrower cannot be loaded', async () => {
    mocks.getBorrowerProfile
      .mockRejectedValueOnce(new Error('Borrower service unavailable'))
      .mockResolvedValueOnce(borrower);

    renderCreate();

    await screen.findByRole('button', { name: 'Retry borrower lookup' });
    fireEvent.click(screen.getByRole('button', { name: /Product Selection/i }));
    const retry = await screen.findByRole('button', { name: 'Retry borrower lookup' });
    fireEvent.click(retry);

    await waitFor(() => expect(screen.getByText('Ahmad bin Rahman')).toBeInTheDocument());
    expect(screen.getByRole('heading', { name: 'Product Selection' })).toBeInTheDocument();
    await waitFor(() => expect(mocks.getBorrowerProfile).toHaveBeenCalledTimes(2));
  });

  it('keeps the URL borrower selected when its switch confirmation is declined', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderCreate();

    await openApplicantSelection();
    fireEvent.click(screen.getByRole('button', { name: 'Change borrower' }));

    expect(confirm).toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Ahmad bin Rahman' })).toBeInTheDocument();
  });
});
