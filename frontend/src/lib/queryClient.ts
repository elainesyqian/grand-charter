import { notifications } from '@mantine/notifications';
import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { ApiError } from '../api/client';

export const ME_KEY = ['me'] as const;

declare module '@tanstack/react-query' {
  interface Register {
    // Set `meta: { quiet: true }` on a mutation that shows its own error inline.
    mutationMeta: { quiet?: boolean };
  }
}

function handleSignedOut(error: unknown) {
  if (error instanceof ApiError && error.status === 401) {
    queryClient.setQueryData(ME_KEY, null);
    return true;
  }
  return false;
}

export const queryClient: QueryClient = new QueryClient({
  queryCache: new QueryCache({ onError: handleSignedOut }),
  mutationCache: new MutationCache({
    onError: (error, _vars, _ctx, mutation) => {
      if (handleSignedOut(error)) return;
      if (error instanceof ApiError && error.status === 409) {
        // Someone else changed the record: show why, then refresh everything on screen.
        notifications.show({
          color: 'orange',
          title: 'This changed in the meantime',
          message: `${error.message}. The page has been refreshed.`,
        });
        void queryClient.invalidateQueries();
        return;
      }
      if (mutation.meta?.quiet) return;
      notifications.show({
        color: 'red',
        title: 'Something went wrong',
        message: error instanceof Error ? error.message : 'Please try again.',
      });
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      refetchOnWindowFocus: true,
      retry: (count, error) =>
        !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 2,
    },
  },
});
