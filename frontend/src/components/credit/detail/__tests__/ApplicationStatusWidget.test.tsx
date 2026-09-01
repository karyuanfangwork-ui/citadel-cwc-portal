import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ApplicationStatusWidget from '../ApplicationStatusWidget';

const props = { currentState: 'DRAFT' as never, nextRequiredAction: null };

describe('ApplicationStatusWidget', () => {
  it('uses contextual fallback copy when no action is assigned', () => {
    render(<ApplicationStatusWidget {...props} />);

    expect(screen.getByText('No action assigned to you')).toBeInTheDocument();
    expect(screen.queryByText('No pending actions')).not.toBeInTheDocument();
  });
});
