import { Button, Group, Text } from '@mantine/core';
import { IconChevronDown } from '@tabler/icons-react';
import type { PagedList } from '../lib/usePagedList';

/** "Showing 50 of 230 updates · Show older", shown only when there are more to load. */
export function ShowOlder({ list, noun }: { list: PagedList; noun: string }) {
  if (!list.hasNextPage) return null;
  return (
    <Group justify="space-between" mt="sm" gap="xs">
      <Text size="xs" c="dimmed">
        Showing {list.items.length} of {list.total} {noun}
      </Text>
      <Button
        variant="subtle"
        size="xs"
        rightSection={<IconChevronDown size={14} />}
        loading={list.isFetchingNextPage}
        onClick={() => void list.fetchNextPage()}
      >
        Show older
      </Button>
    </Group>
  );
}
