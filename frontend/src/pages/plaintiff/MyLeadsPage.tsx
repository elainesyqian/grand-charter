import { Button, Group, Pagination, Paper, Stack, Text, UnstyledButton } from '@mantine/core';
import { IconChevronRight, IconPlus } from '@tabler/icons-react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router';
import { plaintiffApi } from '../../api/plaintiff';
import type { PlaintiffLeadSummary } from '../../api/types';
import { useUser } from '../../auth/AuthContext';
import {
  CaseStatusBadge,
  Empty,
  Loading,
  LoadError,
  PageHeader,
  PlaintiffStatusBadge,
  When,
} from '../../components/ui';
import { CATEGORY_LABELS, REGION_LABELS, recordNumber } from '../../lib/format';
import { useUrlState } from '../../lib/useUrlState';

function LeadCard({ lead }: { lead: PlaintiffLeadSummary }) {
  const navigate = useNavigate();
  return (
    <UnstyledButton
      onClick={() => navigate(`/plaintiff/leads/${lead.id}`)}
      aria-label={`Open ${recordNumber(lead)}`}
    >
      <Paper p="lg" className="gc-row-link" style={{ transition: 'border-color 120ms' }}>
        <Group justify="space-between" wrap="nowrap" gap="md">
          <Stack gap={4} style={{ minWidth: 0 }}>
            <Text fw={600} ff="heading" size="lg">
              {CATEGORY_LABELS[lead.category]}
            </Text>
            <Text size="sm" c="dimmed">
              {recordNumber(lead)} · {REGION_LABELS[lead.region]} · Submitted{' '}
              <When iso={lead.created_at} />
            </Text>
          </Stack>
          <Group gap="xs" wrap="nowrap">
            <PlaintiffStatusBadge status={lead.display_status} />
            {lead.case_status && <CaseStatusBadge status={lead.case_status} />}
            <IconChevronRight size={18} color="var(--gc-muted)" />
          </Group>
        </Group>
      </Paper>
    </UnstyledButton>
  );
}

export function MyLeadsPage() {
  const user = useUser();
  const { page, set } = useUrlState([] as const);
  const leads = useQuery({
    queryKey: ['plaintiff', 'leads', page],
    queryFn: () => plaintiffApi.listLeads(page),
    placeholderData: keepPreviousData,
  });

  const newButton = (
    <Button component={Link} to="/plaintiff/new" leftSection={<IconPlus size={16} />}>
      New lead
    </Button>
  );

  return (
    <>
      <PageHeader
        title="My cases"
        subtitle={`Welcome back, ${user.name.split(' ')[0]}. Track your cases and share documents with your firm.`}
        actions={newButton}
      />
      {leads.isPending ? (
        <Loading />
      ) : leads.isError ? (
        <LoadError error={leads.error} />
      ) : leads.data.total === 0 ? (
        <Paper>
          <Empty
            title="You haven't submitted a lead yet"
            description="Tell us what happened and we'll connect you with a law firm that handles cases like yours."
            action={newButton}
          />
        </Paper>
      ) : (
        <Stack gap="sm">
          {leads.data.items.map((lead) => (
            <LeadCard key={lead.id} lead={lead} />
          ))}
          {leads.data.total > leads.data.page_size && (
            <Group justify="center" mt="md">
              <Pagination
                total={Math.ceil(leads.data.total / leads.data.page_size)}
                value={page}
                onChange={(p) => set({ page: p })}
              />
            </Group>
          )}
        </Stack>
      )}
    </>
  );
}
