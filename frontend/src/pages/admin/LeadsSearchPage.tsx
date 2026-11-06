import { Text } from '@mantine/core';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { adminApi } from '../../api/admin';
import type { AdminLead } from '../../api/types';
import { useFirms } from '../../components/AssignFirmModal';
import { type Column, DataTable, emptyTable } from '../../components/DataTable';
import { FilterSelect, FiltersBar, SearchInput } from '../../components/FiltersBar';
import { LeadStatusBadge, PageHeader, When } from '../../components/ui';
import { RECEIVED_OPTIONS, receivedSince } from '../../lib/filters';
import {
  CATEGORY_LABELS,
  LEAD_STATUS,
  REGION_LABELS,
  categoryOptions,
  regionOptions,
} from '../../lib/format';
import { useUrlState } from '../../lib/useUrlState';

const FILTERS = ['q', 'status', 'firm', 'category', 'region', 'received'] as const;

const statusOptions = Object.entries(LEAD_STATUS).map(([value, s]) => ({ value, label: s.label }));

const columns: Column<AdminLead>[] = [
  { key: 'id', header: '#', render: (l) => l.id, width: 70 },
  {
    key: 'client',
    header: 'Plaintiff',
    render: (l) => (
      <div>
        <Text size="sm" fw={600}>
          {l.name}
        </Text>
        <Text size="xs" c="dimmed">
          {l.email}
        </Text>
      </div>
    ),
  },
  { key: 'category', header: 'Category', render: (l) => CATEGORY_LABELS[l.category] },
  { key: 'region', header: 'Region', render: (l) => REGION_LABELS[l.region], hiddenBelow: 'md' },
  { key: 'status', header: 'Status', render: (l) => <LeadStatusBadge status={l.status} /> },
  {
    key: 'firm',
    header: 'Firm',
    render: (l) =>
      l.firm ? (
        l.firm.name
      ) : (
        <Text size="sm" c="dimmed">
          None
        </Text>
      ),
  },
  {
    key: 'received',
    header: 'Received',
    render: (l) => <When iso={l.created_at} />,
    hiddenBelow: 'sm',
  },
];

export function LeadsSearchPage() {
  const navigate = useNavigate();
  const firms = useFirms();
  const { values, page, set } = useUrlState(FILTERS);

  const query = {
    q: values.q,
    status: values.status,
    firm_id: values.firm,
    category: values.category,
    region: values.region,
    created_from: receivedSince(values.received),
    page,
  };
  const leads = useQuery({
    queryKey: ['admin', 'leads', 'search', query],
    queryFn: () => adminApi.searchLeads(query),
    placeholderData: keepPreviousData,
  });
  const active = FILTERS.some((k) => values[k]);

  return (
    <>
      <PageHeader title="Leads" subtitle="Every lead across all firms." />
      <FiltersBar
        active={active}
        onClear={() =>
          set({ q: null, status: null, firm: null, category: null, region: null, received: null })
        }
      >
        <SearchInput
          value={values.q}
          onChange={(q) => set({ q })}
          placeholder="Search name, email, details or lead #"
        />
        <FilterSelect
          label="Status"
          data={statusOptions}
          value={values.status}
          onChange={(status) => set({ status })}
          width={170}
        />
        <FilterSelect
          label="Firm"
          data={(firms.data ?? []).map((f) => ({ value: String(f.id), label: f.name }))}
          value={values.firm}
          onChange={(firm) => set({ firm })}
          width={200}
        />
        <FilterSelect
          label="Category"
          data={categoryOptions}
          value={values.category}
          onChange={(category) => set({ category })}
        />
        <FilterSelect
          label="Region"
          data={regionOptions}
          value={values.region}
          onChange={(region) => set({ region })}
          width={140}
        />
        <FilterSelect
          label="Received"
          data={RECEIVED_OPTIONS}
          value={values.received}
          onChange={(received) => set({ received })}
          width={150}
        />
      </FiltersBar>
      <DataTable
        columns={columns}
        data={leads.data}
        loading={leads.isFetching}
        onRowClick={(l) => navigate(`/admin/leads/${l.id}`)}
        rowLabel={(l) => `Open lead ${l.id}`}
        onPageChange={(p) => set({ page: p })}
        empty={emptyTable('No leads match', active ? 'Try removing a filter.' : undefined)}
      />
    </>
  );
}
