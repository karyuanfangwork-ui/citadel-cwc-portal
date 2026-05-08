import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorFallback } from '../ErrorFallback';

describe('ErrorFallback', () => {
  const defaultError = new Error('Test error message');
  const resetError = vi.fn();

  it('renders the default title', () => {
    render(<ErrorFallback error={defaultError} resetError={resetError} />);
    expect(screen.getByText('Something went wrong')).toBeTruthy();
  });

  it('renders a custom title', () => {
    render(
      <ErrorFallback error={defaultError} resetError={resetError} title="Custom Error Title" />
    );
    expect(screen.getByText('Custom Error Title')).toBeTruthy();
  });

  it('displays the error message', () => {
    render(<ErrorFallback error={defaultError} resetError={resetError} />);
    expect(screen.getByText('Test error message')).toBeTruthy();
  });

  it('shows fallback text when error has no message', () => {
    const errNoMsg = new Error();
    errNoMsg.message = '';
    render(<ErrorFallback error={errNoMsg} resetError={resetError} />);
    expect(screen.getByText('An unexpected error occurred. Please try again.')).toBeTruthy();
  });

  it('renders the Try Again button', () => {
    render(<ErrorFallback error={defaultError} resetError={resetError} />);
    expect(screen.getByText('Try Again')).toBeTruthy();
  });

  it('calls resetError when Try Again is clicked', () => {
    render(<ErrorFallback error={defaultError} resetError={resetError} />);
    fireEvent.click(screen.getByText('Try Again'));
    expect(resetError).toHaveBeenCalledTimes(1);
  });

  it('does not show error details by default (showDetails=false)', () => {
    render(<ErrorFallback error={defaultError} resetError={resetError} />);
    // Stack trace should not be visible
    expect(screen.queryByText(/Stack Trace/i)).toBeNull();
  });

  it('shows error details when showDetails=true', () => {
    render(
      <ErrorFallback error={defaultError} resetError={resetError} showDetails={true} />
    );
    expect(screen.getByText(/Stack Trace/i)).toBeTruthy();
  });
});