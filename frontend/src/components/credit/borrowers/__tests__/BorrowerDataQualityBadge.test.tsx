import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import BorrowerDataQualityBadge from '../BorrowerDataQualityBadge';

const completeBorrower = {
  dataQuality: 'COMPLETE' as const,
  missingFields: [],
};

const incompleteBorrower = {
  dataQuality: 'INCOMPLETE' as const,
  missingFields: ['name', 'identifier', 'contact'] as Array<'name' | 'identifier' | 'contact' | 'segment' | 'owner'>,
};

const incompleteBorrowerSingleField = {
  dataQuality: 'INCOMPLETE' as const,
  missingFields: ['segment'] as Array<'name' | 'identifier' | 'contact' | 'segment' | 'owner'>,
};

describe('BorrowerDataQualityBadge', () => {
  it('renders nothing for COMPLETE borrowers', () => {
    const { container } = render(<BorrowerDataQualityBadge {...completeBorrower} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders "Data incomplete" text for INCOMPLETE borrowers', () => {
    render(<BorrowerDataQualityBadge {...incompleteBorrower} />);
    expect(screen.getByText(/data incomplete/i)).toBeInTheDocument();
  });

  it('lists missing fields with human-readable labels', () => {
    render(<BorrowerDataQualityBadge {...incompleteBorrower} />);
    expect(screen.getByText(/identifier/i)).toBeInTheDocument();
    expect(screen.getByText(/contact/i)).toBeInTheDocument();
  });

  it('does not rely on color alone — includes text label', () => {
    render(<BorrowerDataQualityBadge {...incompleteBorrower} />);
    const badge = screen.getByText(/data incomplete/i);
    expect(badge).toBeInTheDocument();
    // The badge text itself serves as the non-color indicator
    expect(badge.textContent).toMatch(/incomplete/i);
  });

  it('renders a single missing field correctly', () => {
    render(<BorrowerDataQualityBadge {...incompleteBorrowerSingleField} />);
    expect(screen.getByText(/segment/i)).toBeInTheDocument();
  });
});