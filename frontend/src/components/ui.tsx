// Small presentational building blocks shared by every page.
import {
  Alert,
  Anchor,
  Badge,
  Box,
  Button,
  Center,
  EmptyState,
  Group,
  Loader,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  Title,
  Tooltip,
} from '@mantine/core';
import { IconAlertTriangle, IconArrowLeft, IconMoodEmpty } from '@tabler/icons-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { ApiError } from '../api/client';
import type { CaseStatus, LeadStatus, PlaintiffLeadStatus } from '../api/types';
import {
  CASE_STATUS,
  LEAD_STATUS,
  PLAINTIFF_STATUS,
  formatDate,
  formatDateTime,
  fromNow,
} from '../lib/format';

export function PageHeader({
  title,
  subtitle,
  back,
  badge,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  back?: { to: string; label: string };
  badge?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <Stack gap="xs" mb="xl">
      {back && (
        <Anchor component={Link} to={back.to} size="sm" c="dimmed" w="fit-content">
          <Group gap={4}>
            <IconArrowLeft size={14} />
            {back.label}
          </Group>
        </Anchor>
      )}
      <Group justify="space-between" align="flex-start" gap="md">
        <Stack gap={6} style={{ flex: 1, minWidth: 240 }}>
          <Group gap="sm" align="center">
            <Title order={1}>{title}</Title>
            {badge}
          </Group>
          {subtitle && (
            <Text c="dimmed" size="md">
              {subtitle}
            </Text>
          )}
        </Stack>
        {actions && <Group gap="sm">{actions}</Group>}
      </Group>
    </Stack>
  );
}

export function Section({
  title,
  description,
  actions,
  children,
  bg,
  borderColor,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  bg?: string;
  borderColor?: string;
}) {
  return (
    <Paper p={{ base: 'md', sm: 'lg' }} bg={bg} style={borderColor ? { borderColor } : undefined}>
      <Group justify="space-between" align="flex-start" mb="md" gap="sm">
        <Box>
          <Title order={3}>{title}</Title>
          {description && (
            <Text size="sm" c="dimmed" mt={2}>
              {description}
            </Text>
          )}
        </Box>
        {actions}
      </Group>
      {children}
    </Paper>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Box>
      <Text size="xs" c="dimmed" tt="uppercase" fw={600} style={{ letterSpacing: '0.04em' }}>
        {label}
      </Text>
      <Text size="sm" mt={2} component="div">
        {children}
      </Text>
    </Box>
  );
}

export function FieldGrid({ children }: { children: ReactNode }) {
  return (
    <SimpleGrid cols={{ base: 1, xs: 2, md: 3 }} spacing="lg" verticalSpacing="md">
      {children}
    </SimpleGrid>
  );
}

export const LeadStatusBadge = ({ status }: { status: LeadStatus }) => (
  <Badge color={LEAD_STATUS[status].color}>{LEAD_STATUS[status].label}</Badge>
);

export const CaseStatusBadge = ({ status }: { status: CaseStatus }) => (
  <Badge color={CASE_STATUS[status].color}>{CASE_STATUS[status].label}</Badge>
);

export const PlaintiffStatusBadge = ({ status }: { status: PlaintiffLeadStatus }) => (
  <Badge color={PLAINTIFF_STATUS[status].color}>{PLAINTIFF_STATUS[status].label}</Badge>
);

/** Relative time ("3 days ago") with the exact timestamp on hover. */
export function When({ iso, exact = false }: { iso: string; exact?: boolean }) {
  return (
    <Tooltip label={formatDateTime(iso)}>
      <Text span inherit style={{ whiteSpace: 'nowrap' }}>
        {exact ? formatDate(iso) : fromNow(iso)}
      </Text>
    </Tooltip>
  );
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <Center py={64}>
      <Group gap="sm">
        <Loader color="navy" size="sm" />
        <Text c="dimmed" size="sm">
          {label}
        </Text>
      </Group>
    </Center>
  );
}

export function Empty({
  title,
  description,
  action,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <Box py="xl">
      <EmptyState
        icon={<IconMoodEmpty size={22} />}
        title={title}
        description={description}
        color="navy"
        size="sm"
      >
        {action}
      </EmptyState>
    </Box>
  );
}

/** Error state for a failed query. A 404 means "doesn't exist or isn't yours". */
export function LoadError({ error, backTo }: { error: unknown; backTo?: string }) {
  if (error instanceof ApiError && error.status === 404) {
    return (
      <Empty
        title="We couldn't find that"
        description="It may have been moved to another firm, or you may not have access to it."
        action={
          backTo && (
            <Button component={Link} to={backTo} variant="light" mt="sm">
              Go back
            </Button>
          )
        }
      />
    );
  }
  return (
    <Alert
      color="red"
      icon={<IconAlertTriangle size={18} />}
      title="Couldn't load this page"
      my="lg"
    >
      {error instanceof Error ? error.message : 'Please refresh and try again.'}
    </Alert>
  );
}
