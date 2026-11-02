import { useCallback } from 'react';
import { useSearchParams } from 'react-router';

/**
 * Filters and page number live in the URL, so back/refresh keep your place and views are linkable.
 * Changing any filter resets to page 1.
 */
export function useUrlState<K extends string>(keys: readonly K[]) {
  const [params, setParams] = useSearchParams();

  const values = Object.fromEntries(keys.map((k) => [k, params.get(k)])) as Record<
    K,
    string | null
  >;
  const page = Math.max(1, Number(params.get('page')) || 1);

  const set = useCallback(
    (patch: Partial<Record<K | 'page', string | number | null>>) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [key, value] of Object.entries(patch)) {
            if (value === null || value === undefined || value === '') next.delete(key);
            else next.set(key, String(value));
          }
          if (!('page' in patch)) next.delete('page');
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  return { values, page, set };
}
