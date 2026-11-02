import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type ReactNode, createContext, useContext } from 'react';
import { ApiError } from '../api/client';
import { authApi } from '../api/auth';
import type { Me, Role } from '../api/types';
import { ME_KEY } from '../lib/queryClient';

interface AuthState {
  user: Me | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<Me>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export const ROLE_HOME: Record<Role, string> = {
  plaintiff: '/plaintiff',
  staff: '/firm/inbox',
  admin: '/admin',
};

async function fetchMe(): Promise<Me | null> {
  try {
    return await authApi.me();
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const me = useQuery({ queryKey: ME_KEY, queryFn: fetchMe, staleTime: Infinity });

  const loginMutation = useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      authApi.login(email, password),
    meta: { quiet: true },
    onSuccess: (user) => {
      // Drop anything cached for the previous user before showing the new one.
      qc.removeQueries({ predicate: (q) => q.queryKey[0] !== ME_KEY[0] });
      qc.setQueryData(ME_KEY, user);
    },
  });

  const logoutMutation = useMutation({
    mutationFn: authApi.logout,
    onSettled: () => {
      qc.clear();
      qc.setQueryData(ME_KEY, null);
    },
  });

  const value: AuthState = {
    user: me.data ?? null,
    loading: me.isPending,
    login: (email, password) => loginMutation.mutateAsync({ email, password }),
    logout: () => logoutMutation.mutateAsync(),
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

/** For pages behind <RequireRole>, where a user is guaranteed. */
export function useUser(): Me {
  const { user } = useAuth();
  if (!user) throw new Error('useUser called without a signed-in user');
  return user;
}
