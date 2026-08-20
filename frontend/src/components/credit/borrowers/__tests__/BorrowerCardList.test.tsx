import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, act } from '@testing-library/react';
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
  it('shows loading status and skeletons before the empty state', () => {
    render(<BorrowerCardList profiles={[]} loading onActionClick={vi.fn()} />);

    expect(screen.getByRole('status', { name: 'Loading borrowers' })).toBeInTheDocument();
    expect(screen.queryByText('No borrowers found')).not.toBeInTheDocument();
  });

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

  it('opens Borrower 360 from the card with Enter and Space without nested double-triggering', () => {
    const onOpen360 = vi.fn();
    render(<BorrowerCardList profiles={[borrower]} onOpen360={onOpen360} onActionClick={vi.fn()} />);

    const card = screen.getByRole('article');
    expect(card).toHaveAttribute('tabIndex', '0');

    fireEvent.keyDown(card, { key: 'Enter' });
    fireEvent.keyDown(card, { key: ' ' });
    expect(onOpen360).toHaveBeenCalledTimes(2);

    fireEvent.keyDown(screen.getByRole('button', { name: /actions for Ahmad Enterprise/i }), { key: 'Enter' });
    expect(onOpen360).toHaveBeenCalledTimes(2);
  });

  it('dismisses the action menu on Escape and outside click', () => {
    render(<BorrowerCardList profiles={[borrower]} onActionClick={vi.fn()} />);
    const actions = screen.getByRole('button', { name: /actions for Ahmad Enterprise/i });

    fireEvent.click(actions);
    expect(screen.getByRole('menu')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    fireEvent.click(actions);
    expect(screen.getByRole('menu')).toBeInTheDocument();
    act(() => fireEvent.mouseDown(document.body));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
