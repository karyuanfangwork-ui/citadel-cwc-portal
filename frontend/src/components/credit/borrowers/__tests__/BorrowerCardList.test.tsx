import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import BorrowerCardList from '../BorrowerCardList';
import type { BorrowerListItem } from '@/src/types/credit-ui.types';

const borrower: BorrowerListItem = {
  id: 'borrower-1',
  borrowerNumber: 'BRW-000001',
  name: 'Ahmad Enterprise',
  segment: 'SME',
  legalType: 'CORPORATE',
  maskedIdentifier: '******-10-1234',
  primaryContact: 'a***@example.test',
  relationshipOwner: { id: 'rm-1', name: 'Relationship Manager' },
  activeApplicationCount: 2,
  totalExposure: 45000,
  status: 'ACTIVE',
  dataQuality: 'INCOMPLETE',
  missingFields: ['identifier', 'contact'],
  updatedAt: '2026-08-11T00:00:00.000Z',
};

describe('BorrowerCardList', () => {
  it('shows essential borrower information and expandable secondary details', () => {
    render(<BorrowerCardList profiles={[borrower]} onOpen360={vi.fn()} onActionClick={vi.fn()} />);

    expect(screen.getByRole('region', { name: 'Borrower cards' })).toBeInTheDocument();
    expect(screen.getByText('Ahmad Enterprise')).toBeInTheDocument();
    expect(screen.getByText('BRW-000001')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('RM 45,000')).toBeInTheDocument();
    expect(screen.getByText('2 active applications')).toBeInTheDocument();
    expect(screen.queryByText('******-10-1234')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /show borrower details/i }));

    expect(screen.getByText('******-10-1234')).toBeInTheDocument();
    expect(screen.getByText('a***@example.test')).toBeInTheDocument();
    expect(screen.getByText('Relationship Manager')).toBeInTheDocument();
  });

  it('calls the direct 360 and action-menu callbacks for the selected borrower', () => {
    const onOpen360 = vi.fn();
    const onActionClick = vi.fn();
    render(<BorrowerCardList profiles={[borrower]} onOpen360={onOpen360} onActionClick={onActionClick} />);

    fireEvent.click(screen.getByRole('button', { name: /open Ahmad Enterprise in borrower 360/i }));
    expect(onOpen360).toHaveBeenCalledWith('borrower-1');

    fireEvent.click(screen.getByRole('button', { name: /actions for Ahmad Enterprise/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /edit borrower/i }));
    expect(onActionClick).toHaveBeenCalledWith('borrower-1', 'edit');
  });
});
