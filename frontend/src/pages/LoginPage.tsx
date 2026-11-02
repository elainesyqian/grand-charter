import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Center,
  Group,
  Paper,
  PasswordInput,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { authApi } from '../api/auth';
import type { DemoUser, Me } from '../api/types';
import { ROLE_HOME, useAuth } from '../auth/AuthContext';
import { LogoMark } from '../components/Layout';
import { ROLE_LABELS } from '../lib/format';

function describe(user: DemoUser) {
  return user.firm ? `${user.title ?? 'Staff'} · ${user.firm.name}` : ROLE_LABELS[user.role];
}

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Known accounts power the email suggestions (type to filter, arrow keys to pick).
  const accounts = useQuery({ queryKey: ['demo-users'], queryFn: authApi.demoUsers, retry: false });
  const byEmail = new Map((accounts.data ?? []).map((u) => [u.email, u]));

  if (user) return <Navigate to={ROLE_HOME[user.role]} replace />;

  const go = (signedIn: Me) => {
    const from = (location.state as { from?: string } | null)?.from;
    const home = ROLE_HOME[signedIn.role];
    const area = home.split('/')[1];
    navigate(from?.startsWith(`/${area}`) ? from : home, { replace: true });
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      go(await login(email.trim(), password));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Center mih="100vh" px="md" py="xl" bg="var(--gc-page-bg)">
      <Box w="100%" maw={400}>
        <Stack gap="lg">
          <Center>
            <LogoMark size={48} />
          </Center>
          <Stack gap={4} ta="center">
            <Title order={1}>Sign in</Title>
            <Text c="dimmed">Welcome back. Sign in to continue.</Text>
          </Stack>

          <Paper p="xl" component="form" onSubmit={onSubmit}>
            <Stack gap="md">
              {error && (
                <Alert color="red" icon={<IconAlertTriangle size={18} />} p="sm">
                  {error}
                </Alert>
              )}
              <Autocomplete
                label="Email"
                placeholder="you@example.com"
                required
                autoComplete="username"
                data={[...byEmail.keys()]}
                value={email}
                onChange={setEmail}
                limit={8}
                renderOption={({ option }) => {
                  const u = byEmail.get(option.value);
                  return (
                    <Group gap="sm" wrap="nowrap" justify="space-between" w="100%">
                      <Text size="sm">{option.value}</Text>
                      {u && (
                        <Text size="xs" c="dimmed" truncate title={describe(u)}>
                          {u.name}
                        </Text>
                      )}
                    </Group>
                  );
                }}
                comboboxProps={{ shadow: 'md' }}
                data-autofocus
              />
              <PasswordInput
                label="Password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.currentTarget.value)}
              />
              <Button type="submit" loading={busy} fullWidth mt="xs">
                Sign in
              </Button>
            </Stack>
          </Paper>
        </Stack>
      </Box>
    </Center>
  );
}
