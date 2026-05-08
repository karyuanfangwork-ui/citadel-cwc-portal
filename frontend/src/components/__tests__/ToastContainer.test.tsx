import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ToastProvider, useToast } from '../../context/ToastContext';
import ToastContainer from '../ToastContainer';

// Component that triggers toasts for testing
const ToastTrigger: React.FC<{ type: string; title: string; message: string }> = ({ type, title, message }) => {
  const toast = useToast();
  const handlers: Record<string, () => void> = {
    success: () => toast.success(title, message),
    error: () => toast.error(title, message),
    warning: () => toast.warning(title, message),
    info: () => toast.info(title, message),
  };
  return <button onClick={handlers[type]}>Show Toast</button>;
};

const renderWithProvider = (ui: React.ReactElement) =>
  render(<ToastProvider>{ui}</ToastProvider>);

describe('ToastContainer', () => {
  it('renders without crashes when no toasts are present', () => {
    renderWithProvider(<ToastContainer />);
    // Container exists but has no toast items
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('renders a success toast when triggered', () => {
    renderWithProvider(
      <>
        <ToastTrigger type="success" title="Success!" message="Operation completed" />
        <ToastContainer />
      </>
    );
    fireEvent.click(screen.getByText('Show Toast'));
    expect(screen.getByText('Success!')).toBeTruthy();
    expect(screen.getByText('Operation completed')).toBeTruthy();
  });

  it('renders an error toast when triggered', () => {
    renderWithProvider(
      <>
        <ToastTrigger type="error" title="Error!" message="Something failed" />
        <ToastContainer />
      </>
    );
    fireEvent.click(screen.getByText('Show Toast'));
    expect(screen.getByText('Error!')).toBeTruthy();
    expect(screen.getByText('Something failed')).toBeTruthy();
  });

  it('renders a warning toast when triggered', () => {
    renderWithProvider(
      <>
        <ToastTrigger type="warning" title="Warning!" message="Check this" />
        <ToastContainer />
      </>
    );
    fireEvent.click(screen.getByText('Show Toast'));
    expect(screen.getByText('Warning!')).toBeTruthy();
  });

  it('renders an info toast when triggered', () => {
    renderWithProvider(
      <>
        <ToastTrigger type="info" title="Info" message="FYI" />
        <ToastContainer />
      </>
    );
    fireEvent.click(screen.getByText('Show Toast'));
    expect(screen.getByText('Info')).toBeTruthy();
  });
});