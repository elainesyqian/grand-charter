import { type QueryKey, useInfiniteQuery } from '@tanstack/react-query';
import type { Page } from '../api/types';

/**
 * A newest-first sub-list (updates, notes, documents, history) that loads one page at a time.
 * A case can have hundreds of these, so the first page shows right away and "Show older"
 * appends the next one.
 */
export function usePagedList<T extends { id: number }>(
  queryKey: QueryKey,
  fetchPage: (page: number) => Promise<Page<T>>,
  { enabled = true }: { enabled?: boolean } = {},
) {
  const query = useInfiniteQuery({
    queryKey,
    enabled,
    queryFn: ({ pageParam }) => fetchPage(pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.page * last.page_size < last.total ? last.page + 1 : undefined,
  });

  // A record added after page 1 loaded shifts the offsets by one, so the next page can repeat
  // an item. Drop repeats by id rather than showing it twice.
  const seen = new Set<number>();
  const items: T[] = [];
  for (const page of query.data?.pages ?? []) {
    for (const item of page.items) {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        items.push(item);
      }
    }
  }
  const total = query.data?.pages[0]?.total ?? 0;
  return { ...query, items, total };
}

export type PagedList = Pick<
  ReturnType<typeof usePagedList>,
  'items' | 'total' | 'hasNextPage' | 'isFetchingNextPage' | 'fetchNextPage'
>;
