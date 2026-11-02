import { Box, Group, LoadingOverlay, Pagination, Paper, Table, Text } from '@mantine/core';
import type { ReactNode } from 'react';
import type { Page } from '../api/types';
import { Empty } from './ui';

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  width?: number | string;
  hiddenBelow?: 'sm' | 'md';
}

/**
 * Paginated table with clickable, keyboard-accessible rows.
 * Keeps showing the previous page while the next one loads (no layout jump).
 */
export function DataTable<T extends { id: number }>({
  columns,
  data,
  loading,
  onRowClick,
  onPageChange,
  empty,
  rowLabel,
}: {
  columns: Column<T>[];
  data: Page<T> | undefined;
  loading: boolean;
  onRowClick?: (row: T) => void;
  onPageChange: (page: number) => void;
  empty: ReactNode;
  rowLabel?: (row: T) => string;
}) {
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;
  const first = data && data.total > 0 ? (data.page - 1) * data.page_size + 1 : 0;
  const last = data ? Math.min(data.total, data.page * data.page_size) : 0;

  return (
    <Paper p={0} pos="relative" style={{ overflow: 'hidden' }}>
      <LoadingOverlay
        visible={loading && !!data}
        overlayProps={{ backgroundOpacity: 0.4 }}
        loaderProps={{ size: 'sm' }}
      />
      {data && data.items.length === 0 ? (
        empty
      ) : (
        <Table.ScrollContainer minWidth={560}>
          <Table highlightOnHover={!!onRowClick} verticalSpacing="sm" horizontalSpacing="md">
            <Table.Thead bg="stone.0">
              <Table.Tr>
                {columns.map((c) => (
                  <Table.Th key={c.key} w={c.width} visibleFrom={c.hiddenBelow}>
                    <Text
                      size="xs"
                      fw={600}
                      c="dimmed"
                      tt="uppercase"
                      style={{ letterSpacing: '0.04em' }}
                    >
                      {c.header}
                    </Text>
                  </Table.Th>
                ))}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {!data &&
                Array.from({ length: 5 }).map((_, i) => (
                  <Table.Tr key={i}>
                    <Table.Td colSpan={columns.length}>
                      <Box h={20} bg="stone.0" style={{ borderRadius: 4 }} />
                    </Table.Td>
                  </Table.Tr>
                ))}
              {data?.items.map((row) => (
                <Table.Tr
                  key={row.id}
                  className={onRowClick ? 'gc-row-link' : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  aria-label={rowLabel?.(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  onKeyDown={
                    onRowClick
                      ? (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onRowClick(row);
                          }
                        }
                      : undefined
                  }
                >
                  {columns.map((c) => (
                    <Table.Td key={c.key} visibleFrom={c.hiddenBelow}>
                      {c.render(row)}
                    </Table.Td>
                  ))}
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}
      {data && data.total > 0 && (
        <Group
          justify="space-between"
          px="md"
          py="sm"
          style={{ borderTop: '1px solid var(--gc-border)' }}
        >
          <Text size="sm" c="dimmed">
            Showing {first.toLocaleString()}–{last.toLocaleString()} of{' '}
            {data.total.toLocaleString()}
          </Text>
          {totalPages > 1 && (
            <Pagination
              size="sm"
              total={totalPages}
              value={data.page}
              onChange={onPageChange}
              siblings={1}
            />
          )}
        </Group>
      )}
    </Paper>
  );
}

export const emptyTable = (title: string, description?: string, action?: ReactNode) => (
  <Empty title={title} description={description} action={action} />
);
