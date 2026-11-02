import { SegmentedControl, Text } from '@mantine/core';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { firmApi } from '../../api/firm';
import type { InboxLead } from '../../api/types';
import { useUser } from '../../auth/AuthContext';
import { type Column, DataTable, emptyTable } from '../../components/DataTable';
import { FilterSelect, FiltersBar, SearchInput } from '../../components/FiltersBar';
import { LeadStatusBadge, PageHeader, When } from '../../components/ui';
import { RECEIVED_OPTIONS, receivedSince } from '../../lib/filters';
import { CATEGORY_LABELS, REGION_LABELS, categoryOptions, regionOptions } from '../../lib/format';
import { useUrlState } from '../../lib/useUrlState';

const FILTERS = ['view', 'q', 'category', 'region', 'received'] as const;

const columns: Column<InboxLead>[] = [
  { key: 'received', header: 'Received', render: (l) => <When iso={l.created_at} />, width: 140 },
  {
    key: 'client',
    header: 'Client',
    render: (l) => (
      <Text size="sm" fw={600}>
        {l.name}
      </Text>
    ),
  },
  { key: 'category', header: 'Category', render: (l) => CATEGORY_LABELS[l.category] },
  { key: 'region', header: 'Region', render: (l) => REGION_LABELS[l.region], hiddenBelow: 'sm' },
  {
    key: 'status',
    header: 'Status',
    render: (l) => <LeadStatusBadge status={l.status} />,
    width: 170,
  },
];

export function InboxPage() {
  const user = useUser();
  const navigate = useNavigate();
  const { values, page, set } = useUrlState(FILTERS);
  const view = values.view === 'accepted' ? 'accepted' : 'new';

  const query = {
    status: view === 'new' ? 'assigned' : 'accepted',
    q: values.q,
    category: values.category,
    region: values.region,
    created_from: receivedSince(values.received),
    page,
  };
  const leads = useQuery({
    queryKey: ['firm', 'leads', query],
    queryFn: () => firmApi.listInbox(query),
    placeholderData: keepPreviousData,
  });
  const filtersActive = !!(values.q || values.category || values.region || values.received);

  return (
    <>
      <PageHeader
        title="Inbox"
        subtitle={`New requests routed to ${user.firm?.name}. Review each one and accept or decline it.`}
      />
      <SegmentedControl
        mb="md"
        value={view}
        onChange={(v) => set({ view: v === 'new' ? null : v })}
        data={[
          { value: 'new', label: 'Awaiting decision' },
          { value: 'accepted', label: 'Accepted' },
        ]}
      />
      <FiltersBar
        active={filtersActive}
        onClear={() => set({ q: null, category: null, region: null, received: null })}
      >
        <SearchInput
          value={values.q}
          onChange={(q) => set({ q })}
          placeholder="Search by name, email or details"
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
        <FilterSelect
          label="Received"
          data={RECEIVED_OPTIONS}
          value={values.received}
          onChange={(received) => set({ received })}
          width={160}
        />
      </FiltersBar>
      <DataTable
        columns={columns}
        data={leads.data}
        loading={leads.isFetching}
        onRowClick={(l) => navigate(`/firm/leads/${l.id}`)}
        rowLabel={(l) => `Open request from ${l.name}`}
        onPageChange={(p) => set({ page: p })}
        empty={
          filtersActive
            ? emptyTable(
                'No requests match these filters',
                'Try clearing a filter or searching for something else.',
              )
            : view === 'new'
              ? emptyTable(
                  "You're all caught up",
                  'New requests routed to your firm will show up here.',
                )
              : emptyTable('No accepted requests yet')
        }
      />
    </>
  );
}
