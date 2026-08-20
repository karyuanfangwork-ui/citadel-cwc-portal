import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';

const mocks = vi.hoisted(() => ({
  createBorrowerProfile: vi.fn(),
  createAccount: vi.fn(),
  createContact: vi.fn(),
  listAccounts: vi.fn(),
  listContacts: vi.fn(),
}));

vi.mock('../../../services/credit.service', () => ({
  default: {
    createBorrowerProfile: mocks.createBorrowerProfile,
  },
}));

vi.mock('../../../services/crm.service', () => ({
  default: {
    listAccounts: mocks.listAccounts,
    listContacts: mocks.listContacts,
    createAccount: mocks.createAccount,
    createContact: mocks.createContact,
  },
}));

import NewBorrowerWizard from '../NewBorrowerWizard';

const LocationProbe = () => {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}{location.search}</output>;
};

describe('NewBorrowerWizard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createBorrowerProfile.mockResolvedValue({ id: 'borrower-42' });
  });

  it('hands off to canonical creation without offering orphan CRM actions', async () => {
    const onClose = vi.fn();

    render(
      <MemoryRouter initialEntries={['/credit/applications/application-1']}>
        <NewBorrowerWizard isOpen onClose={onClose} />
        <LocationProbe />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Continue to borrower creation' }));

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/credit/borrowers/new?returnTo=application');
    });
    expect(mocks.createBorrowerProfile).not.toHaveBeenCalled();
    expect(mocks.createAccount).not.toHaveBeenCalled();
    expect(mocks.createContact).not.toHaveBeenCalled();
    expect(mocks.listAccounts).not.toHaveBeenCalled();
    expect(mocks.listContacts).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/Link to CRM/i)).not.toBeInTheDocument();
  });
});
