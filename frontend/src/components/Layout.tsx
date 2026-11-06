import {
  AppShell,
  Avatar,
  Badge,
  Box,
  Burger,
  Container,
  Drawer,
  Group,
  Menu,
  Progress,
  Stack,
  Text,
  ThemeIcon,
  UnstyledButton,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconChevronDown, IconLogout, IconScale } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { Link, NavLink, Outlet, useNavigate, useNavigation } from 'react-router';
import { adminApi } from '../api/admin';
import { firmApi } from '../api/firm';
import type { Me } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { ROLE_LABELS } from '../lib/format';

interface NavItem {
  to: string;
  label: string;
  end?: boolean;
  count?: number;
}

function useNavItems(user: Me | null): NavItem[] {
  // Small "needs attention" counters next to the inbox / queue links.
  const inbox = useQuery({
    queryKey: ['firm', 'leads', 'count'],
    queryFn: () => firmApi.listInbox({ status: 'assigned', page_size: 1 }),
    enabled: user?.role === 'staff',
  });
  const queue = useQuery({
    queryKey: ['admin', 'leads', 'count'],
    queryFn: () => adminApi.searchLeads({ status: ['unassigned', 'declined'], page_size: 1 }),
    enabled: user?.role === 'admin',
  });

  switch (user?.role) {
    case 'plaintiff':
      return [
        { to: '/plaintiff', label: 'My cases', end: true },
        { to: '/plaintiff/new', label: 'New lead' },
      ];
    case 'staff':
      return [
        { to: '/firm/inbox', label: 'Inbox', count: inbox.data?.total },
        { to: '/firm/cases', label: 'Cases' },
      ];
    case 'admin':
      return [
        { to: '/admin', label: 'Needs attention', end: true, count: queue.data?.total },
        { to: '/admin/leads', label: 'Leads' },
        { to: '/admin/cases', label: 'Cases' },
        { to: '/admin/audit', label: 'Audit log' },
      ];
    default:
      return [];
  }
}

function NavLinks({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  return items.map((item) => (
    <NavLink key={item.to} to={item.to} end={item.end} onClick={onNavigate} className="gc-nav-link">
      {({ isActive }) => (
        <Group gap={6} wrap="nowrap">
          <span>{item.label}</span>
          {!!item.count && (
            <Badge
              size="sm"
              variant="filled"
              color={isActive ? 'navy' : 'army'}
              circle={item.count < 10}
            >
              {item.count}
            </Badge>
          )}
        </Group>
      )}
    </NavLink>
  ));
}

function initials(name: string) {
  return name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function UserMenu({ user }: { user: Me }) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const signOut = async () => {
    await logout();
    navigate('/login');
  };
  const subtitle = user.firm
    ? `${user.title ?? 'Staff'} · ${user.firm.name}`
    : ROLE_LABELS[user.role];

  return (
    <Menu position="bottom-end" width={240} shadow="md">
      <Menu.Target>
        <UnstyledButton aria-label="Account menu">
          <Group gap="xs" wrap="nowrap">
            <Avatar color="navy" radius="xl" size={34}>
              {initials(user.name)}
            </Avatar>
            <Box visibleFrom="sm" style={{ lineHeight: 1.2 }}>
              <Text size="sm" fw={600}>
                {user.name}
              </Text>
              <Text size="xs" c="dimmed">
                {subtitle}
              </Text>
            </Box>
            <IconChevronDown size={14} color="var(--gc-muted)" />
          </Group>
        </UnstyledButton>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>Signed in as {user.email}</Menu.Label>
        <Menu.Item leftSection={<IconLogout size={16} />} onClick={signOut}>
          Sign out
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}

/** The logo: just the scales-of-justice mark, no product name. */
export function LogoMark({ size = 34 }: { size?: number }) {
  return (
    <ThemeIcon color="navy" size={size} radius="md" aria-hidden>
      <IconScale size={Math.round(size * 0.56)} />
    </ThemeIcon>
  );
}

export function Layout() {
  const { user } = useAuth();
  const items = useNavItems(user);
  const [drawerOpen, drawer] = useDisclosure(false);
  const navigating = useNavigation().state !== 'idle';

  return (
    <AppShell header={{ height: 64 }} padding={0}>
      <AppShell.Header style={{ borderBottom: '1px solid var(--gc-border)' }}>
        {navigating && (
          <Progress
            value={100}
            animated
            size={3}
            radius={0}
            color="navy"
            pos="absolute"
            top={0}
            left={0}
            right={0}
            aria-label="Loading page"
          />
        )}
        <Container size="xl" h="100%">
          <Group h="100%" justify="space-between" wrap="nowrap">
            <Group gap="xl" wrap="nowrap">
              <Burger
                opened={drawerOpen}
                onClick={drawer.toggle}
                hiddenFrom="sm"
                size="sm"
                aria-label="Menu"
              />
              <Link to="/" aria-label="Home" style={{ display: 'flex' }}>
                <LogoMark />
              </Link>
              <Group gap={4} visibleFrom="sm" component="nav" aria-label="Main">
                <NavLinks items={items} />
              </Group>
            </Group>
            {user && <UserMenu user={user} />}
          </Group>
        </Container>
      </AppShell.Header>

      <Drawer
        opened={drawerOpen}
        onClose={drawer.close}
        size="xs"
        title={<LogoMark size={30} />}
        hiddenFrom="sm"
      >
        <Stack gap={4} component="nav" aria-label="Main">
          <NavLinks items={items} onNavigate={drawer.close} />
        </Stack>
      </Drawer>

      <AppShell.Main>
        <Container size="xl" py={{ base: 'lg', sm: 'xl' }} px={{ base: 'md', sm: 'xl' }}>
          <Outlet />
        </Container>
      </AppShell.Main>
    </AppShell>
  );
}
