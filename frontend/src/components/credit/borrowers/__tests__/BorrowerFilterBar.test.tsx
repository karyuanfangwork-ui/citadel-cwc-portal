import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import BorrowerFilterBar, { type BorrowerFilterState } from '../BorrowerFilterBar';

const defaultFilters: BorrowerFilterState = {
  search: '',
  segmentFilter: '',
  statusFilter: '',
  activeApplicationFilter: '',
};

describe('BorrowerFilterBar', () => {
  it('marks the search control for full-width wrapping on narrow filter rows', () => {
    const { container } = render(<BorrowerFilterBar filters={defaultFilters} onFilterChange={vi.fn()} />);

    const searchLabel = container.querySelector('label');

    expect(searchLabel).toHaveClass('borrower-filter-search');
    expect(searchLabel).toHaveStyle({
      minWidth: '0',
    });
  });

  it('announces active filters count on the button', () => {
    const filters: BorrowerFilterState = { ...defaultFilters, segmentFilter: 'INDIVIDUAL', statusFilter: 'ACTIVE' };
    render(<BorrowerFilterBar filters={filters} onFilterChange={vi.fn()} />);
    // The filter button shows "(2)" for 2 active filters
    const filterButton = screen.getByRole('button', { name: /filters \(2\)/i });
    expect(filterButton).toHaveTextContent('2');
  });

  it('opens and closes the filter popover with keyboard', () => {
    render(<BorrowerFilterBar filters={defaultFilters} onFilterChange={vi.fn()} />);
    const filterButton = screen.getByRole('button', { name: /^filters$/i });
    fireEvent.click(filterButton);
    expect(screen.getByRole('dialog', { name: /borrower filters/i })).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('dialog', { name: /borrower filters/i }), { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: /borrower filters/i })).not.toBeInTheDocument();
  });

  it('returns focus to the Filters button after closing the popover', () => {
    render(<BorrowerFilterBar filters={defaultFilters} onFilterChange={vi.fn()} />);
    const filterButton = screen.getByRole('button', { name: /^filters$/i });
    fireEvent.click(filterButton);
    fireEvent.keyDown(screen.getByRole('dialog', { name: /borrower filters/i }), { key: 'Escape' });
    expect(filterButton).toHaveFocus();
  });

  it('resets all filter fields on Clear all filters', () => {
    const onFilterChange = vi.fn();
    const filters: BorrowerFilterState = { search: 'test', segmentFilter: 'INDIVIDUAL', statusFilter: 'ACTIVE', activeApplicationFilter: '' };
    render(<BorrowerFilterBar filters={filters} onFilterChange={onFilterChange} />);
    // Search is also an active filter, so the button shows "Filters (3)"
    const filterButton = screen.getByRole('button', { name: /filters \(3\)/i });
    fireEvent.click(filterButton);
    const clearButton = screen.getByRole('button', { name: /clear all filters/i });
    fireEvent.click(clearButton);
    expect(onFilterChange).toHaveBeenCalledWith(expect.objectContaining({
      search: '',
      segmentFilter: '',
      statusFilter: '',
      activeApplicationFilter: '',
    }));
  });

  it('has an accessible heading in the filter popover', () => {
    render(<BorrowerFilterBar filters={defaultFilters} onFilterChange={vi.fn()} />);
    const filterButton = screen.getByRole('button', { name: /^filters$/i });
    fireEvent.click(filterButton);
    expect(screen.getByRole('heading', { name: /filters/i })).toBeInTheDocument();
  });

  it('has a visible close button inside the popover', () => {
    render(<BorrowerFilterBar filters={defaultFilters} onFilterChange={vi.fn()} />);
    const filterButton = screen.getByRole('button', { name: /^filters$/i });
    fireEvent.click(filterButton);
    const dialog = screen.getByRole('dialog', { name: /borrower filters/i });
    const closeButtons = dialog.querySelectorAll('button[aria-label="Close"]');
    expect(closeButtons.length).toBeGreaterThanOrEqual(1);
  });
});
