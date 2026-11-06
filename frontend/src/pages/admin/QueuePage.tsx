import { Badge, Button, Group, Stack, Text, Title } from '@mantine/core';
import { IconArrowRight } from '@tabler/icons-react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { adminApi } from '../../api/admin';
import type { AdminLead } from '../../api/types';
import { AssignFirmModal } from '../../components/AssignFirmModal';
import { type Column, DataTable, emptyTable } from '../../components/DataTable';
import { PageHeader, When } from '../../components/ui';
import { CATEGORY_LABELS, REGION_LABELS } from '../../lib/format';
import { useUrlState } from '../../lib/useUrlState';
import { useAssignLead } from './useAssign';

function QueueTable({
  status,
  title,
  description,
  pageKey,
  onAssign,
}: {
  status: 'unassigned' | 'declined';
  title: string;
  description: string;
  pageKey: 'upage' | 'dpage';
  onAssign: (lead: AdminLead) => void;
}) {
  const navigate = useNavigate();
  const { values, set } = useUrlState([pageKey] as const);
  const page = Number(values[pageKey]) || 1;
  const leads = useQuery({
    queryKey: ['admin', 'leads', 'queue', status, page],
    queryFn: () => adminApi.searchLeads({ status, page, page_size: 10 }),
    placeholderData: keepPreviousData,
  });

  const columns: Column<AdminLead>[] = [
    { key: 'received', header: 'Received', render: (l) => <When iso={l.created_at} />, width: 130 },
    {
      key: 'client',
      header: 'Lead',
      render: (l) => (
        <div>
          <Text size="sm" fw={600}>
            {l.name}
          </Text>
          <Text size="xs" c="dimmed">
            #{l.id} · {CATEGORY_LABELS[l.category]} · {REGION_LABELS[l.region]}
          </Text>
        </div>
      ),
    },
    ...(status === 'declined'
      ? [
          {
            key: 'declined',
            header: 'Declined by',
            render: (l: AdminLead) =>
              l.latest_decline && (
                <div>
                  <Text size="sm">{l.latest_decline.firm.name}</Text>
                  <Text size="xs" c="dimmed" lineClamp={2} maw={320}>
                    “{l.latest_decline.reason}”
                  </Text>
                </div>
              ),
          },
        ]
      : [
          {
            key: 'why',
            header: 'Why it’s here',
            render: () => (
              <Text size="sm" c="dimmed">
                No firm covers this category in this region
              </Text>
            ),
            hiddenBelow: 'md' as const,
          },
        ]),
    {
      key: 'action',
      header: '',
      width: 120,
      render: (l) => (
        <Button
          size="xs"
          variant="light"
          onClick={(e) => {
            e.stopPropagation();
            onAssign(l);
          }}
        >
          Assign
        </Button>
      ),
    },
  ];

  return (
    <Stack gap="sm">
      <Group gap="sm" align="baseline">
        <Title order={2}>{title}</Title>
        {leads.data && (
          <Badge color={status === 'declined' ? 'red' : 'orange'} size="lg" variant="light">
            {leads.data.total}
          </Badge>
        )}
      </Group>
      <Text size="sm" c="dimmed" mt={-6}>
        {description}
      </Text>
      <DataTable
        columns={columns}
        data={leads.data}
        loading={leads.isFetching}
        onRowClick={(l) => navigate(`/admin/leads/${l.id}`)}
        rowLabel={(l) => `Open lead ${l.id}`}
        onPageChange={(p) => set({ [pageKey]: p } as Record<typeof pageKey, number>)}
        empty={emptyTable(
          'Nothing here',
          status === 'declined' ? 'No declined leads to resolve.' : 'Every lead has a firm.',
        )}
      />
    </Stack>
  );
}

export function QueuePage() {
  const navigate = useNavigate();
  const [target, setTarget] = useState<AdminLead | null>(null);
  const assign = useAssignLead(() => setTarget(null));

  return (
    <>
      <PageHeader
        title="Needs attention"
        subtitle="Leads that couldn't be routed automatically, or that a firm turned down."
        actions={
          <Button
            variant="default"
            rightSection={<IconArrowRight size={16} />}
            onClick={() => navigate('/admin/leads')}
          >
            Search all leads
          </Button>
        }
      />
      <Stack gap={40}>
        <QueueTable
          status="unassigned"
          title="Unassigned"
          description="No firm is mapped to these category/region pairs. Pick one manually."
          pageKey="upage"
          onAssign={setTarget}
        />
        <QueueTable
          status="declined"
          title="Declined"
          description="A firm declined these. Find another firm, or send them back with context."
          pageKey="dpage"
          onAssign={setTarget}
        />
      </Stack>
      <AssignFirmModal
        key={target?.id}
        opened={!!target}
        onClose={() => setTarget(null)}
        kind="lead"
        currentFirm={target?.firm ?? null}
        declines={target?.latest_decline ? [target.latest_decline] : []}
        loading={assign.isPending}
        onConfirm={(firmId, reason) =>
          target && assign.mutate({ leadId: target.id, firmId, reason })
        }
      />
    </>
  );
}
