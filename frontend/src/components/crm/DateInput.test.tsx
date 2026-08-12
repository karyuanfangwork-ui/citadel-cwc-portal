import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import DateInput from './DateInput';

describe('DateInput', () => {
  it('displays ISO dates as DD/MM/YYYY', () => {
    render(<DateInput value="2026-08-12" onChange={vi.fn()} />);

    expect(screen.getByRole('textbox')).toHaveValue('12/08/2026');
  });

  it('converts valid DD/MM/YYYY input back to ISO', () => {
    const onChange = vi.fn();
    render(<DateInput onChange={onChange} />);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '12/08/2026' } });

    expect(onChange).toHaveBeenLastCalledWith('2026-08-12');
  });

  it('provides a calendar picker and converts its selection', () => {
    const onChange = vi.fn();
    render(<DateInput onChange={onChange} />);

    expect(screen.getByRole('button', { name: /open calendar/i })).toBeInTheDocument();
    const nativeDateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    fireEvent.change(nativeDateInput, { target: { value: '2026-08-12' } });

    expect(screen.getByRole('textbox')).toHaveValue('12/08/2026');
    expect(onChange).toHaveBeenLastCalledWith('2026-08-12');
  });

  it('keeps partial input while the field is being edited', () => {
    render(<DateInput onChange={vi.fn()} />);
    const input = screen.getByRole('textbox');

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '12' } });

    expect(input).toHaveValue('12');
  });

  it('does not emit an invalid calendar date', () => {
    const onChange = vi.fn();
    render(<DateInput onChange={onChange} />);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '31/02/2026' } });

    expect(onChange).toHaveBeenLastCalledWith('');
  });
});
