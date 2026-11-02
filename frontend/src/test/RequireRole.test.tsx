import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';
import { RequireRole } from '../auth/RequireRole';
import { mockApi, plaintiffUser, renderWithProviders } from './utils';

const app = (
  <Routes>
    <Route path="/login" element={<p>login page</p>} />
    <Route path="/plaintiff" element={<p>plaintiff home</p>} />
    <Route element={<RequireRole role="admin" />}>
      <Route path="/admin" element={<p>admin secret</p>} />
    </Route>
  </Routes>
);

describe('RequireRole', () => {
  it('sends signed-out users to the login page', async () => {
    mockApi({ '/api/auth/me': { status: 401, body: { detail: 'Not signed in' } } });
    renderWithProviders(app, { route: '/admin' });
    expect(await screen.findByText('login page')).toBeInTheDocument();
    expect(screen.queryByText('admin secret')).not.toBeInTheDocument();
  });

  it('sends users with the wrong role to their own home page', async () => {
    mockApi({ '/api/auth/me': { body: plaintiffUser } });
    renderWithProviders(app, { route: '/admin' });
    expect(await screen.findByText('plaintiff home')).toBeInTheDocument();
    expect(screen.queryByText('admin secret')).not.toBeInTheDocument();
  });

  it('renders the page for the right role', async () => {
    mockApi({ '/api/auth/me': { body: { ...plaintiffUser, role: 'admin' } } });
    renderWithProviders(app, { route: '/admin' });
    expect(await screen.findByText('admin secret')).toBeInTheDocument();
  });
});
