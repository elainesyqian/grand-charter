import { apiGet, apiSend } from './client';
import type { DemoUser, Me, Meta } from './types';

export const authApi = {
  me: () => apiGet<Me>('/auth/me'),
  login: (email: string, password: string) =>
    apiSend<Me>('POST', '/auth/login', { email, password }),
  logout: () => apiSend<void>('POST', '/auth/logout'),
  demoUsers: () => apiGet<DemoUser[]>('/auth/demo-users'),
  meta: () => apiGet<Meta>('/meta'),
};
