import { useEffect, useState } from 'react';

/**
 * Returns `value` after it has been stable for `delay` ms.
 * Use to gate keystroke-driven effects (search, autocomplete) so they don't
 * fire on every character.
 */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}
