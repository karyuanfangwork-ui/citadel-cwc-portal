import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import BorrowerQuickPreview from '../BorrowerQuickPreview';
import type { BorrowerListItem } from '@/src/types/credit-ui.types';

const baseBorrower: BorrowerListItem = {
  id: 'b-1',
  borrowerNumber: 'BWR-001',
  name: 'Acme Corp',
  segment: 'CORPORATE',
  legalType: 'CORPORATE',
  maskedIdentifier: '****1234',
  primaryContact: 'jo***@acme.com',
  relationshipOwner: { id: 'u-1', name: 'Jane Doe' },
  activeApplicationCount: 2,
  totalExposure: 500000,
  status: 'ACTIVE',
  dataQuality: 'COMPLETE',
  missingFields: [],
  updatedAt: '2026-08-01T00:00:00Z',
};

const incompleteBorrower: BorrowerListItem = {
  ...baseBorrower,
  id: 'b-2',
  name: '',
  maskedIdentifier: null,
  primaryContact: null,
  segment: null,
  dataQuality: 'INCOMPLETE',
  missingFields: ['name', 'identifier', 'contact', 'segment'],
};

describe('BorrowerQuickPreview', () => {
  it('renders as a dialog with role="dialog"', () => {
    render(
      <BorrowerQuickPreview
        borrower={baseBorrower}
        onClose={vi.fn()}
        onOpen360={vi.fn()}
        onNewApp={vi.fn()}
      />,
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('has aria-modal="true" and an aria-labelledby', () => {
    render(
      <BorrowerQuickPreview
        borrower={baseBorrower}
        onClose={vi.fn()}
        onOpen360={vi.fn()}
        onNewApp={vi.fn()}
      />,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog.getAttribute('aria-labelledby')).toBeTruthy();
  });

  it('has a close button', () => {
    render(
      <BorrowerQuickPreview
        borrower={baseBorrower}
        onClose={vi.fn()}
        onOpen360={vi.fn()}
        onNewApp={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
  });

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn();
    render(
      <BorrowerQuickPreview
        borrower={baseBorrower}
        onClose={onClose}
        onOpen360={vi.fn()}
        onNewApp={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose on Escape key', () => {
    const onClose = vi.fn();
    render(
      <BorrowerQuickPreview
        borrower={baseBorrower}
        onClose={onClose}
        onOpen360={vi.fn()}
        onNewApp={vi.fn()}
      />,
    );
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('invokes onOpen360 callback', () => {
    const onOpen360 = vi.fn();
    render(
      <BorrowerQuickPreview
        borrower={baseBorrower}
        onClose={vi.fn()}
        onOpen360={onOpen360}
        onNewApp={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /open 360 view/i }));
    expect(onOpen360).toHaveBeenCalledWith('b-1');
  });

  it('invokes onNewApp callback', () => {
    const onNewApp = vi.fn();
    render(
      <BorrowerQuickPreview
        borrower={baseBorrower}
        onClose={vi.fn()}
        onOpen360={vi.fn()}
        onNewApp={onNewApp}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /new application/i }));
    expect(onNewApp).toHaveBeenCalledWith('b-1');
  });

  it('shows data quality warning for incomplete borrowers', () => {
    render(
      <BorrowerQuickPreview
        borrower={incompleteBorrower}
        onClose={vi.fn()}
        onOpen360={vi.fn()}
        onNewApp={vi.fn()}
      />,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/incomplete profile/i)).toBeInTheDocument();
  });

  it('shows the data quality badge for incomplete borrowers', () => {
    render(
      <BorrowerQuickPreview
        borrower={incompleteBorrower}
        onClose={vi.fn()}
        onOpen360={vi.fn()}
        onNewApp={vi.fn()}
      />,
    );
    expect(screen.getByText(/data incomplete/i)).toBeInTheDocument();
  });
});