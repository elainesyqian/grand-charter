import { MantineProvider } from '@mantine/core';
import { ModalsProvider } from '@mantine/modals';
import { Notifications } from '@mantine/notifications';
import { QueryClientProvider } from '@tanstack/react-query';
import { Navigate, RouterProvider, createBrowserRouter, type RouteObject } from 'react-router';
import { AuthProvider } from './auth/AuthContext';
import { HomeRedirect, RequireRole } from './auth/RequireRole';
import { Layout } from './components/Layout';
import { Loading } from './components/ui';
import { queryClient } from './lib/queryClient';
import { LoginPage } from './pages/LoginPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { theme } from './theme/theme';

// Each page is its own chunk, so users only download the screens their role uses.
const page = (load: () => Promise<Record<string, unknown>>, name: string) => async () => ({
  Component: (await load())[name] as React.ComponentType,
});

export const routes: RouteObject[] = [
  { path: '/login', element: <LoginPage /> },
  { path: '/', element: <HomeRedirect /> },
  {
    element: <Layout />,
    hydrateFallbackElement: <Loading />,
    children: [
      {
        element: <RequireRole role="plaintiff" />,
        children: [
          {
            path: '/plaintiff',
            lazy: page(() => import('./pages/plaintiff/MyLeadsPage'), 'MyLeadsPage'),
          },
          {
            path: '/plaintiff/new',
            lazy: page(() => import('./pages/plaintiff/NewLeadPage'), 'NewLeadPage'),
          },
          {
            path: '/plaintiff/leads/:id',
            lazy: page(() => import('./pages/plaintiff/LeadDetailPage'), 'LeadDetailPage'),
          },
        ],
      },
      {
        element: <RequireRole role="staff" />,
        children: [
          { path: '/firm', element: <Navigate to="/firm/inbox" replace /> },
          { path: '/firm/inbox', lazy: page(() => import('./pages/firm/InboxPage'), 'InboxPage') },
          {
            path: '/firm/leads/:id',
            lazy: page(() => import('./pages/firm/FirmLeadPage'), 'FirmLeadPage'),
          },
          { path: '/firm/cases', lazy: page(() => import('./pages/firm/CasesPage'), 'CasesPage') },
          {
            path: '/firm/cases/:id',
            lazy: page(() => import('./pages/firm/FirmCasePage'), 'FirmCasePage'),
          },
        ],
      },
      {
        element: <RequireRole role="admin" />,
        children: [
          { path: '/admin', lazy: page(() => import('./pages/admin/QueuePage'), 'QueuePage') },
          {
            path: '/admin/leads',
            lazy: page(() => import('./pages/admin/LeadsSearchPage'), 'LeadsSearchPage'),
          },
          {
            path: '/admin/leads/:id',
            lazy: page(() => import('./pages/admin/AdminLeadPage'), 'AdminLeadPage'),
          },
          {
            path: '/admin/cases',
            lazy: page(() => import('./pages/admin/CasesSearchPage'), 'CasesSearchPage'),
          },
          {
            path: '/admin/cases/:id',
            lazy: page(() => import('./pages/admin/AdminCasePage'), 'AdminCasePage'),
          },
          {
            path: '/admin/audit',
            lazy: page(() => import('./pages/admin/AuditPage'), 'AuditPage'),
          },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];

const router = createBrowserRouter(routes);

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <MantineProvider theme={theme} forceColorScheme="light">
      <Notifications position="top-right" autoClose={4000} />
      <QueryClientProvider client={queryClient}>
        <ModalsProvider labels={{ confirm: 'Confirm', cancel: 'Cancel' }}>
          <AuthProvider>{children}</AuthProvider>
        </ModalsProvider>
      </QueryClientProvider>
    </MantineProvider>
  );
}

export function App() {
  return (
    <Providers>
      <RouterProvider router={router} />
    </Providers>
  );
}
