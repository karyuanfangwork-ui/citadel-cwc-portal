import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { initialFormData } from '../../components/credit/create-borrower/BasicInfoStep';

const mocks = vi.hoisted(() => ({
  getApplicationDraft: vi.fn().mockResolvedValue(null),
  saveApplicationDraft: vi.fn().mockResolvedValue({ id: 'draft-1' }),
  searchBorrowers: vi.fn().mockResolvedValue([]),
  checkBorrowerIdentity: vi.fn(),
}));

vi.mock('../../services/credit.service', () => ({
  default: {
    getApplicationDraft: mocks.getApplicationDraft,
    saveApplicationDraft: mocks.saveApplicationDraft,
    searchBorrowers: mocks.searchBorrowers,
    checkBorrowerIdentity: mocks.checkBorrowerIdentity,
  },
}));

vi.mock('../../hooks/useDuplicateCheck', () => ({
  useDuplicateCheck: () => ({
    dupCheck: 'clear',
    dupBorrowerId: null,
    dupError: null,
    runCheck: vi.fn(),
    reset: vi.fn(),
  }),
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: { permissions: [] } }),
}));

import CreateBorrowerPage from '../../../pages/CreateBorrowerPage';

function validIndividualDraft() {
  return {
    ...initialFormData(),
    borrowerType: 'INDIVIDUAL' as const,
    name: 'Aisha Rahman',
    nric: '900101-14-1234',
    dateOfBirth: '1990-01-01',
    nationality: 'Malaysian',
    phone: '0123456789',
  };
}

const noExactIdentityMatch = {
  exactMatch: false,
  match: null,
  exceptionRequestId: null,
};

describe('CreateBorrowerPage governed identity gate', () => {
  beforeEach(() => {
    localStorage.clear();
    mocks.getApplicationDraft.mockResolvedValue(null);
    mocks.checkBorrowerIdentity.mockReset();
    mocks.searchBorrowers.mockReset();
    mocks.searchBorrowers.mockResolvedValue([]);
    localStorage.setItem('createBorrowerDraft', JSON.stringify({
      formData: {
        ...validIndividualDraft(),
      },
      currentStep: 0,
      onboardingKey: 'identity-gate-test',
    }));
  });

  it('keeps creation disabled after direct navigation to Review when no governed identity result exists', async () => {
    render(
      <MemoryRouter initialEntries={['/credit/borrowers/new']}>
        <CreateBorrowerPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(mocks.getApplicationDraft).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: /Review & Create/ }));

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Final Review' })).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /Create Borrower Record/ })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('Governed identity check: Complete the governed identity check before creating.');
  });

  it('keeps creation disabled after a governed identity check fails', async () => {
    mocks.getApplicationDraft.mockResolvedValue({ id: 'draft-1', payload: { formData: validIndividualDraft() } });
    mocks.checkBorrowerIdentity.mockRejectedValueOnce(new Error('Identity service unavailable'));

    render(
      <MemoryRouter initialEntries={['/credit/borrowers/new']}>
        <CreateBorrowerPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(mocks.getApplicationDraft).toHaveBeenCalled());
    fireEvent.change(screen.getByPlaceholderText('Search NRIC, Passport, CIF, Mobile or Email...'), { target: { value: '900101' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check Identity' }));

    await waitFor(() => expect(mocks.checkBorrowerIdentity).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Identity check failed.'));
    fireEvent.click(screen.getByRole('button', { name: /Review & Create/ }));

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Final Review' })).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /Create Borrower Record/ })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('Governed identity check: Identity check failed. Run it again before creating.');
  });

  it('runs the governed identity check when the user taps Search Records', async () => {
    mocks.getApplicationDraft.mockResolvedValue({ id: 'draft-1', payload: { formData: validIndividualDraft() } });
    mocks.checkBorrowerIdentity.mockResolvedValueOnce(noExactIdentityMatch);

    render(
      <MemoryRouter initialEntries={['/credit/borrowers/new']}>
        <CreateBorrowerPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(mocks.getApplicationDraft).toHaveBeenCalled());
    fireEvent.change(screen.getByPlaceholderText('Search NRIC, Passport, CIF, Mobile or Email...'), { target: { value: '900101141234' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search Records' }));

    await waitFor(() => expect(mocks.searchBorrowers).toHaveBeenCalledWith('900101141234'));
    await waitFor(() => expect(mocks.checkBorrowerIdentity).toHaveBeenCalledWith(expect.objectContaining({
      draftId: 'draft-1',
      segment: 'INDIVIDUAL',
      identifier: '900101141234',
      identifierType: 'NRIC',
    })));
    expect(await screen.findByText('No exact identity match found. You may continue.')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Continue after identity check/ }).some(button => !(button as HTMLButtonElement).disabled)).toBe(true);
  });

  it('invalidates a successful governed check when the checked NRIC is edited', async () => {
    mocks.getApplicationDraft.mockResolvedValue({ id: 'draft-1', payload: { formData: validIndividualDraft() } });
    mocks.checkBorrowerIdentity.mockResolvedValueOnce(noExactIdentityMatch);

    render(
      <MemoryRouter initialEntries={['/credit/borrowers/new']}>
        <CreateBorrowerPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(mocks.getApplicationDraft).toHaveBeenCalled());
    fireEvent.change(screen.getByPlaceholderText('Search NRIC, Passport, CIF, Mobile or Email...'), { target: { value: '900101141234' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check Identity' }));
    await waitFor(() => expect(screen.getByText('No exact identity match found. You may continue.')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Borrower Details/ }));
    fireEvent.change(screen.getByPlaceholderText('e.g. 901231-14-5678'), { target: { value: '901231-14-5678' } });
    fireEvent.click(screen.getByRole('button', { name: /Review & Create/ }));

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Final Review' })).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /Create Borrower Record/ })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('Governed identity check: Complete the governed identity check before creating.');
  });

  it('does not authorize form NRIC B from a successful governed check for query A', async () => {
    mocks.getApplicationDraft.mockResolvedValue({
      id: 'draft-1',
      payload: { formData: { ...validIndividualDraft(), nric: '901231-14-5678' } },
    });
    mocks.checkBorrowerIdentity.mockResolvedValueOnce(noExactIdentityMatch);

    render(
      <MemoryRouter initialEntries={['/credit/borrowers/new']}>
        <CreateBorrowerPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(mocks.getApplicationDraft).toHaveBeenCalled());
    fireEvent.change(screen.getByPlaceholderText('Search NRIC, Passport, CIF, Mobile or Email...'), { target: { value: '900101141234' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check Identity' }));
    await waitFor(() => expect(screen.getByText('No exact identity match found. You may continue.')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Review & Create/ }));

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Final Review' })).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /Create Borrower Record/ })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('Governed identity check: Complete the governed identity check before creating.');
  });

  it('ignores a stale governed identity response after the NRIC changes', async () => {
    let resolveIdentityCheck!: (value: typeof noExactIdentityMatch) => void;
    mocks.getApplicationDraft.mockResolvedValue({ id: 'draft-1', payload: { formData: validIndividualDraft() } });
    mocks.checkBorrowerIdentity.mockImplementationOnce(() => new Promise(resolve => {
      resolveIdentityCheck = resolve;
    }));

    render(
      <MemoryRouter initialEntries={['/credit/borrowers/new']}>
        <CreateBorrowerPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(mocks.getApplicationDraft).toHaveBeenCalled());
    fireEvent.change(screen.getByPlaceholderText('Search NRIC, Passport, CIF, Mobile or Email...'), { target: { value: '900101141234' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check Identity' }));
    await waitFor(() => expect(mocks.checkBorrowerIdentity).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: /Borrower Details/ }));
    fireEvent.change(screen.getByPlaceholderText('e.g. 901231-14-5678'), { target: { value: '901231-14-5678' } });
    await act(async () => resolveIdentityCheck(noExactIdentityMatch));
    fireEvent.click(screen.getByRole('button', { name: /Review & Create/ }));

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Final Review' })).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /Create Borrower Record/ })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('Governed identity check: Complete the governed identity check before creating.');
  });
});
