import { Text } from '@mantine/core';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { adminApi } from '../../api/admin';
import type { AdminCase } from '../../api/types';
import { useFirms } from '../../components/AssignFirmModal';
import { type Column, DataTable, emptyTable } from '../../components/DataTable';
import { FilterSelect, FiltersBar, SearchInput } from '../../components/FiltersBar';
import { CaseStatusBadge, PageHeader, When } from '../../components/ui';
import { CASE_STATUS, CATEGORY_LABELS, categoryOptions, regionOptions } from '../../lib/format';
import { useUrlState } from '../../lib/useUrlState';

const FILTERS = ['q', 'status', 'firm', 'category', 'region'] as const;
const statusOptions = Object.entries(CASE_STATUS).map(([value, s]) => ({ value, label: s.label }));

const columns: Column<AdminCase>[] = [
  { key: 'id', header: 'Case', render: (c) => `#${c.id}`, width: 80 },
  {
    key: 'client',
    header: 'Plaintiff',
    render: (c) => (
      <Text size="sm" fw={600}>
        {c.plaintiff_name}
      </Text>
    ),
  },
  { key: 'category', header: 'Category', render: (c) => CATEGORY_LABELS[c.category] },
  { key: 'firm', header: 'Firm', render: (c) => c.firm.name },
  { key: 'status', header: 'Status', render: (c) => <CaseStatusBadge status={c.status} /> },
  {
    key: 'updated',
    header: 'Last activity',
    render: (c) => <When iso={c.updated_at} />,
    hiddenBelow: 'sm',
  },
];

export function CasesSearchPage() {
  const navigate = useNavigate();
  const firms = useFirms();
  const { values, page, set } = useUrlState(FILTERS);

  const query = {
    q: values.q,
    status: values.status,
    firm_id: values.firm,
    category: values.category,
    region: values.region,
    page,
  };
  const cases = useQuery({
    queryKey: ['admin', 'cases', 'search', query],
    queryFn: () => adminApi.searchCases(query),
    placeholderData: keepPreviousData,
  });
  const active = FILTERS.some((k) => values[k]);

  return (
    <>
      <PageHeader title="Cases" subtitle="Every case across all firms." />
      <FiltersBar
        active={active}
        onClear={() => set({ q: null, status: null, firm: null, category: null, region: null })}
      >
        <SearchInput
          value={values.q}
          onChange={(q) => set({ q })}
          placeholder="Search plaintiff, email, details or case #"
        />
        <FilterSelect
          label="Status"
          data={statusOptions}
          value={values.status}
          onChange={(status) => set({ status })}
          width={160}
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
      </FiltersBar>
      <DataTable
        columns={columns}
        data={cases.data}
        loading={cases.isFetching}
        onRowClick={(c) => navigate(`/admin/cases/${c.id}`)}
        rowLabel={(c) => `Open case ${c.id}`}
        onPageChange={(p) => set({ page: p })}
        empty={emptyTable('No cases match', active ? 'Try removing a filter.' : undefined)}
      />
    </>
  );
}
