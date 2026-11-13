import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { useDraftSave } from './useDraftSave';

beforeEach(() => { localStorage.clear(); vi.useFakeTimers(); });
afterEach(() => vi.useRealTimers());

test('an executive-only selection is saved and restored under its request type key', () => {
  const data = { summary: '', description: '', customFields: {}, executiveApproverId: 'ceo-1', executiveApproverRole: 'CEO' };
  const setData = vi.fn();
  const { result, unmount } = renderHook(() => useDraftSave('request_desk_cat_type-a', data, setData, 20));
  act(() => { vi.advanceTimersByTime(21); });
  expect(result.current.hasDraft).toBe(true);
  unmount();

  const anotherType = renderHook(() => useDraftSave('request_desk_cat_type-b', data, setData, 20));
  expect(anotherType.result.current.hasDraft).toBe(false);
  expect(anotherType.result.current.restoreDraft()).toBe(false);
  anotherType.unmount();

  const restored = renderHook(() => useDraftSave('request_desk_cat_type-a', { summary: '', description: '', customFields: {} }, setData, 20));
  expect(restored.result.current.hasDraft).toBe(true);
  expect(restored.result.current.restoreDraft()).toBe(true);
  expect(setData).toHaveBeenCalledWith(data);
});

test('switching request types clears the prior type draft indicator', () => {
  const data = { summary: '', description: '', customFields: {}, executiveApproverId: 'ceo-1', executiveApproverRole: 'CEO' };
  const hook = renderHook(({ key }) => useDraftSave(key, data, vi.fn(), 20), { initialProps: { key: 'request_desk_cat_type-a' } });
  act(() => { vi.advanceTimersByTime(21); });
  expect(hook.result.current.hasDraft).toBe(true);
  hook.rerender({ key: 'request_desk_cat_type-b' });
  expect(hook.result.current.hasDraft).toBe(false);
  expect(hook.result.current.restoreDraft()).toBe(false);
});
