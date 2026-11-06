import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { vi } from 'vitest';
import { AuthProvider } from '../auth/AuthContext';
import { theme } from '../theme/theme';

/** Mock `fetch` by path. Unlisted paths return 404. */
export function mockApi(routes: Record<string, { status?: number; body?: unknown }>) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = new URL(String(input), 'http://localhost');
    const hit = routes[url.pathname];
    const status = hit?.status ?? (hit ? 200 : 404);
    const body = hit?.body ?? (hit ? {} : { detail: 'Not found' });
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  });
}

export function renderWithProviders(ui: ReactElement, { route = '/' }: { route?: string } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <MantineProvider theme={theme} forceColorScheme="light">
      <QueryClientProvider client={client}>
        <AuthProvider>
          <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    </MantineProvider>
  );
  return render(ui, { wrapper: Wrapper });
}

export const plaintiffUser = {
  id: 2,
  name: 'Liam Lester',
  email: 'plaintiff1@demo',
  role: 'plaintiff',
  title: null,
  firm: null,
};
