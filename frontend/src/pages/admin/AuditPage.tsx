import { Anchor, Text } from '@mantine/core';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { adminApi } from '../../api/admin';
import type { AuditAction, AuditEventOut } from '../../api/types';
import { firmNameMap, useFirms } from '../../components/AssignFirmModal';
import { actorLabel, describeEvent, entityLink } from '../../components/AuditTimeline';
import { type Column, DataTable, emptyTable } from '../../components/DataTable';
import { FilterSelect, FiltersBar } from '../../components/FiltersBar';
import { PageHeader, When } from '../../components/ui';
import { RECEIVED_OPTIONS, receivedSince } from '../../lib/filters';
import { useUrlState } from '../../lib/useUrlState';

const FILTERS = ['entity', 'action', 'when'] as const;

const ACTION_LABELS: Record<AuditAction, string> = {
  'lead.created': 'Lead submitted',
  'lead.routed': 'Routed automatically',
  'lead.unmatched': 'No firm matched',
  'lead.assigned': 'Assigned by admin',
  'lead.accepted': 'Accepted by firm',
  'lead.declined': 'Declined by firm',
  'case.created': 'Case opened',
  'case.status_changed': 'Case status changed',
  'case.reassigned': 'Case reassigned',
};

export function AuditPage() {
  const firms = useFirms();
  const names = firmNameMap(firms.data);
  const { values, page, set } = useUrlState(FILTERS);

  const query = {
    entity_type: values.entity,
    action: values.action,
    created_from: receivedSince(values.when),
    page,
  };
  const events = useQuery({
    queryKey: ['admin', 'audit', query],
    queryFn: () => adminApi.audit(query),
    placeholderData: keepPreviousData,
  });

  const columns: Column<AuditEventOut>[] = [
    { key: 'when', header: 'When', render: (e) => <When iso={e.created_at} />, width: 140 },
    {
      key: 'what',
      header: 'What happened',
      render: (e) => (
        <div>
          <Text size="sm" fw={500}>
            {describeEvent(e, names).text}
          </Text>
          {e.reason && (
            <Text size="xs" c="dimmed" lineClamp={2}>
              “{e.reason}”
            </Text>
          )}
        </div>
      ),
    },
    {
      key: 'record',
      header: 'Record',
      width: 130,
      render: (e) => (
        <Anchor component={Link} to={entityLink(e)} size="sm">
          {e.entity_type === 'lead' ? `Lead #${e.entity_id}` : `Case #${e.entity_id}`}
        </Anchor>
      ),
    },
    { key: 'by', header: 'By', render: (e) => actorLabel(e), hiddenBelow: 'sm' },
  ];

  return (
    <>
      <PageHeader
        title="Audit log"
        subtitle="Who changed an assignment or status, what changed, and when."
      />
      <FiltersBar
        active={FILTERS.some((k) => values[k])}
        onClear={() => set({ entity: null, action: null, when: null })}
      >
        <FilterSelect
          label="Record type"
          data={[
            { value: 'lead', label: 'Leads' },
            { value: 'case', label: 'Cases' },
          ]}
          value={values.entity}
          onChange={(entity) => set({ entity })}
          width={160}
        />
        <FilterSelect
          label="Action"
          data={Object.entries(ACTION_LABELS).map(([value, label]) => ({ value, label }))}
          value={values.action}
          onChange={(action) => set({ action })}
          width={220}
        />
        <FilterSelect
          label="When"
          data={RECEIVED_OPTIONS}
          value={values.when}
          onChange={(when) => set({ when })}
          width={160}
        />
      </FiltersBar>
      <DataTable
        columns={columns}
        data={events.data}
        loading={events.isFetching}
        onPageChange={(p) => set({ page: p })}
        empty={emptyTable('No events match these filters')}
      />
    </>
  );
}
