import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import BorrowerDataTable from '../BorrowerDataTable';
import type { BorrowerListItem } from '@/src/types/credit-ui.types';

// Minimal fixture builder
const makeBorrower = (overrides: Partial<BorrowerListItem> = {}): BorrowerListItem => ({
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
  ...overrides,
});

const defaultProps = {
  loading: false,
  sortBy: 'updatedAt' as const,
  sortDirection: 'desc' as const,
  canCreate: true,
  canWrite: true,
  onSort: vi.fn(),
  onRowClick: vi.fn(),
  onNameClick: vi.fn(),
  onActiveApplicationsClick: vi.fn(),
  onActionClick: vi.fn(),
};

describe('BorrowerDataTable', () => {
  it('exposes aria-sort on sortable column headers', () => {
    render(<BorrowerDataTable profiles={[makeBorrower()]} {...defaultProps} />);
    const nameHeader = screen.getByRole('button', { name: /sort by borrower/i });
    expect(nameHeader.closest('th')).toHaveAttribute('aria-sort');
  });

  it('sets aria-sort="ascending" on the active sort column', () => {
    render(<BorrowerDataTable profiles={[makeBorrower()]} {...defaultProps} sortBy="name" sortDirection="asc" />);
    const nameHeader = screen.getByRole('button', { name: /sort by borrower/i });
    expect(nameHeader.closest('th')).toHaveAttribute('aria-sort', 'ascending');
  });

  it('sets aria-sort="none" on inactive sortable columns', () => {
    render(<BorrowerDataTable profiles={[makeBorrower()]} {...defaultProps} sortBy="name" sortDirection="desc" />);
    const segmentHeader = screen.getByRole('button', { name: /sort by type \/ segment/i });
    expect(segmentHeader.closest('th')).toHaveAttribute('aria-sort', 'none');
  });

  it('makes rows keyboard-focusable', () => {
    render(<BorrowerDataTable profiles={[makeBorrower()]} {...defaultProps} />);
    const row = screen.getByRole('row', { name: /acme corp/i });
    expect(row).toHaveAttribute('tabIndex', '0');
  });

  it('opens preview on Enter key', () => {
    const onRowClick = vi.fn();
    render(<BorrowerDataTable profiles={[makeBorrower()]} {...defaultProps} onRowClick={onRowClick} />);
    const row = screen.getByRole('row', { name: /acme corp/i });
    fireEvent.keyDown(row, { key: 'Enter' });
    expect(onRowClick).toHaveBeenCalledWith('b-1');
  });

  it('opens preview on click', () => {
    const onRowClick = vi.fn();
    render(<BorrowerDataTable profiles={[makeBorrower()]} {...defaultProps} onRowClick={onRowClick} />);
    const row = screen.getByRole('row', { name: /acme corp/i });
    fireEvent.click(row);
    expect(onRowClick).toHaveBeenCalledWith('b-1');
  });

  it('clicking the borrower name does not also trigger row selection', () => {
    const onRowClick = vi.fn();
    const onNameClick = vi.fn();
    render(<BorrowerDataTable profiles={[makeBorrower()]} {...defaultProps} onRowClick={onRowClick} onNameClick={onNameClick} />);
    // The name cell button just says "Acme Corp" — the actions button says "Actions for Acme Corp"
    const nameButton = screen.getByRole('button', { name: /^Acme Corp$/i });
    fireEvent.click(nameButton);
    expect(onNameClick).toHaveBeenCalledWith('b-1');
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it('clicking the application count does not also trigger row selection', () => {
    const onRowClick = vi.fn();
    const onAppClick = vi.fn();
    render(<BorrowerDataTable profiles={[makeBorrower()]} {...defaultProps} onRowClick={onRowClick} onActiveApplicationsClick={onAppClick} />);
    fireEvent.click(screen.getByRole('button', { name: /2 active applications/i }));
    expect(onAppClick).toHaveBeenCalledWith('b-1');
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it('closes action menu on Escape', () => {
    render(<BorrowerDataTable profiles={[makeBorrower()]} {...defaultProps} />);
    const actionsButton = screen.getByRole('button', { name: /actions for acme corp/i });
    fireEvent.click(actionsButton);
    expect(screen.getByRole('menu')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('closes action menu on outside click', () => {
    render(<BorrowerDataTable profiles={[makeBorrower()]} {...defaultProps} />);
    const actionsButton = screen.getByRole('button', { name: /actions for acme corp/i });
    fireEvent.click(actionsButton);
    expect(screen.getByRole('menu')).toBeInTheDocument();
    // The mousedown handler uses document.addEventListener
    act(() => {
      fireEvent.mouseDown(document.body);
    });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('renders data quality badge for incomplete borrowers', () => {
    render(<BorrowerDataTable profiles={[makeBorrower({ dataQuality: 'INCOMPLETE', missingFields: ['name', 'identifier'] })]} {...defaultProps} />);
    expect(screen.getByText(/data incomplete/i)).toBeInTheDocument();
  });

  it('does not render data quality badge for complete borrowers', () => {
    render(<BorrowerDataTable profiles={[makeBorrower()]} {...defaultProps} />);
    expect(screen.queryByText(/data incomplete/i)).not.toBeInTheDocument();
  });
});