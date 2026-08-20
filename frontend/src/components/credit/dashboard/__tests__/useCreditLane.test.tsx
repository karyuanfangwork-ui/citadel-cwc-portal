import { act, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LaneSwitcher from '../LaneSwitcher';
import { CREDIT_LANE_STORAGE_KEY, availableLanes, useCreditLane } from '../useCreditLane';

const userWith = (permissions: string[]) => ({ id: 'u1', permissions } as any);

describe('useCreditLane', () => {
  beforeEach(() => localStorage.clear());

  it('defaults a plain credit user to the RM lane', () => {
    const { result } = renderHook(() => useCreditLane(userWith(['credit:read'])));
    expect(result.current.lane).toBe('rm');
    expect(result.current.lanes).toEqual(['rm']);
  });

  it('defaults an approver to the approver lane', () => {
    const { result } = renderHook(() => useCreditLane(userWith(['credit:read', 'credit:approve'])));
    expect(result.current.lane).toBe('approver');
  });

  it('defaults an administrator to the manager lane', () => {
    const { result } = renderHook(() => useCreditLane(userWith(['credit:read', 'credit:admin'])));
    expect(result.current.lane).toBe('manager');
  });

  it('offers every qualifying lane to a multi-hat user', () => {
    expect(availableLanes(userWith(['credit:read', 'credit:approve', 'credit:admin'])))
      .toEqual(['rm', 'approver', 'manager']);
  });

  it('prefers an explicit stored choice over permission inference', () => {
    localStorage.setItem(CREDIT_LANE_STORAGE_KEY, 'rm');
    const { result } = renderHook(() => useCreditLane(userWith(['credit:read', 'credit:approve'])));
    expect(result.current.lane).toBe('rm');
  });

  it('ignores a stored lane the user no longer qualifies for', () => {
    localStorage.setItem(CREDIT_LANE_STORAGE_KEY, 'manager');
    const { result } = renderHook(() => useCreditLane(userWith(['credit:read', 'credit:approve'])));
    expect(result.current.lane).toBe('approver');
  });

  it('persists a lane change', () => {
    const { result } = renderHook(() => useCreditLane(userWith(['credit:read', 'credit:approve'])));
    act(() => result.current.setLane('rm'));
    expect(result.current.lane).toBe('rm');
    expect(localStorage.getItem(CREDIT_LANE_STORAGE_KEY)).toBe('rm');
  });

  it('falls back to the RM lane for a user with no credit permissions', () => {
    const { result } = renderHook(() => useCreditLane(userWith([])));
    expect(result.current.lane).toBe('rm');
  });
});

describe('LaneSwitcher', () => {
  it('renders nothing when the user qualifies for only one lane', () => {
    const { container } = render(<LaneSwitcher lane="rm" lanes={['rm']} onChange={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('marks the active lane and reports a change', async () => {
    const onChange = vi.fn();
    render(<LaneSwitcher lane="approver" lanes={['rm', 'approver']} onChange={onChange} />);
    expect(screen.getByRole('tab', { name: 'Decisions' })).toHaveAttribute('aria-selected', 'true');
    await userEvent.click(screen.getByRole('tab', { name: 'My deals' }));
    expect(onChange).toHaveBeenCalledWith('rm');
  });
});
