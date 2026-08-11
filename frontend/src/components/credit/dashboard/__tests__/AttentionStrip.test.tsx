import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import AttentionStrip from '../AttentionStrip';

describe('AttentionStrip', () => {
  it('renders the four operational attention counts as accessible links', () => {
    render(
      <MemoryRouter>
        <AttentionStrip attention={{ overdue: 2, dueSoon: 3, informationRequired: 4, returned: 5 }} />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'Overdue: 2' })).toHaveAttribute('href', '/credit/applications?quickFilter=overdue');
    expect(screen.getByRole('link', { name: 'Due soon: 3' })).toHaveAttribute('href', '/credit/applications?quickFilter=dueSoon');
    expect(screen.getByRole('link', { name: 'Information required: 4' })).toHaveAttribute('href', '/credit/applications?quickFilter=informationRequired');
    expect(screen.getByRole('link', { name: 'Returned: 5' })).toHaveAttribute('href', '/credit/applications?quickFilter=returned');
  });
});
