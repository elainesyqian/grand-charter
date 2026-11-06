import { SegmentedControl, Text } from '@mantine/core';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { firmApi } from '../../api/firm';
import type { FirmCaseSummary } from '../../api/types';
import { useUser } from '../../auth/AuthContext';
import { type Column, DataTable, emptyTable } from '../../components/DataTable';
import { FilterSelect, FiltersBar, SearchInput } from '../../components/FiltersBar';
import { CaseStatusBadge, PageHeader, When } from '../../components/ui';
import {
  CASE_STATUS,
  CASE_STATUS_ORDER,
  CATEGORY_LABELS,
  categoryOptions,
  regionOptions,
} from '../../lib/format';
import { useUrlState } from '../../lib/useUrlState';

const FILTERS = ['status', 'q', 'category', 'region'] as const;

const columns: Column<FirmCaseSummary>[] = [
  { key: 'id', header: 'Case', render: (c) => `#${c.id}`, width: 90 },
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
  {
    key: 'status',
    header: 'Status',
    render: (c) => <CaseStatusBadge status={c.status} />,
    width: 140,
  },
  {
    key: 'updated',
    header: 'Last activity',
    render: (c) => <When iso={c.updated_at} />,
    hiddenBelow: 'sm',
    width: 150,
  },
];

export function CasesPage() {
  const user = useUser();
  const navigate = useNavigate();
  const { values, page, set } = useUrlState(FILTERS);
  const status = values.status ?? 'active';

  const query = {
    // "Active" = everything except closed.
    status:
      status === 'active'
        ? ['open', 'in_progress', 'on_hold']
        : status === 'all'
          ? undefined
          : status,
    q: values.q,
    category: values.category,
    region: values.region,
    page,
  };
  const cases = useQuery({
    queryKey: ['firm', 'cases', query],
    queryFn: () => firmApi.listCases(query),
    placeholderData: keepPreviousData,
  });
  const filtersActive = !!(values.q || values.category || values.region);

  return (
    <>
      <PageHeader title="Cases" subtitle={`Matters ${user.firm?.name} is working on.`} />
      <SegmentedControl
        mb="md"
        value={status}
        onChange={(v) => set({ status: v === 'active' ? null : v })}
        data={[
          { value: 'active', label: 'Active' },
          ...CASE_STATUS_ORDER.map((s) => ({ value: s, label: CASE_STATUS[s].label })),
          { value: 'all', label: 'All' },
        ]}
        style={{ overflowX: 'auto', maxWidth: '100%' }}
      />
      <FiltersBar
        active={filtersActive}
        onClear={() => set({ q: null, category: null, region: null })}
      >
        <SearchInput
          value={values.q}
          onChange={(q) => set({ q })}
          placeholder="Search by plaintiff, email, details or case #"
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
          width={150}
        />
      </FiltersBar>
      <DataTable
        columns={columns}
        data={cases.data}
        loading={cases.isFetching}
        onRowClick={(c) => navigate(`/firm/cases/${c.id}`)}
        rowLabel={(c) => `Open case ${c.id}`}
        onPageChange={(p) => set({ page: p })}
        empty={
          filtersActive
            ? emptyTable('No cases match these filters')
            : emptyTable('No cases here yet', 'Accept a lead from your inbox to open a case.')
        }
      />
    </>
  );
}
