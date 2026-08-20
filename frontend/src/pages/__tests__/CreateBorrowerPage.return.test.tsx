import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';

const mocks = vi.hoisted(() => ({
  getApplicationDraft: vi.fn().mockResolvedValue(null),
  saveApplicationDraft: vi.fn().mockResolvedValue({ id: 'draft-1' }),
}));

vi.mock('../../services/credit.service', () => ({
  default: {
    getApplicationDraft: mocks.getApplicationDraft,
    saveApplicationDraft: mocks.saveApplicationDraft,
  },
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: { permissions: [] } }),
}));

vi.mock('../../components/credit/create-borrower/DuplicateCheckStep', () => ({
  default: ({ onUseExisting }: { onUseExisting: (borrowerId: string) => void }) => (
    <button type="button" onClick={() => onUseExisting('borrower-42')}>Use governed existing borrower</button>
  ),
}));

import CreateBorrowerPage from '../../../pages/CreateBorrowerPage';

const LocationProbe = () => {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}{location.search}</output>;
};

describe('CreateBorrowerPage existing borrower return context', () => {
  it('returns a governed existing borrower to a new application when requested', async () => {
    render(
      <MemoryRouter initialEntries={['/credit/borrowers/new?returnTo=application']}>
        <CreateBorrowerPage />
        <LocationProbe />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Use governed existing borrower' }));

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/credit/applications/new?borrowerId=borrower-42');
    });
  });
});
