import { Group, Text, Timeline } from '@mantine/core';
import { IconArrowRight, IconMessage } from '@tabler/icons-react';
import type { CaseUpdateOut } from '../api/types';
import { CASE_STATUS } from '../lib/format';
import { CaseStatusBadge, When } from './ui';

/** Client-visible progress timeline, newest first. */
export function UpdatesTimeline({ updates }: { updates: CaseUpdateOut[] }) {
  return (
    <Timeline bulletSize={26} lineWidth={2} color="navy">
      {updates.map((u) => {
        const statusChange = u.to_status !== null;
        return (
          <Timeline.Item
            key={u.id}
            color={statusChange ? CASE_STATUS[u.to_status!].color : 'navy'}
            bullet={statusChange ? <IconArrowRight size={14} /> : <IconMessage size={14} />}
            title={
              statusChange ? (
                <Group gap={6}>
                  <Text fw={600} size="sm">
                    Status changed to
                  </Text>
                  <CaseStatusBadge status={u.to_status!} />
                </Group>
              ) : (
                <Text fw={600} size="sm">
                  Update
                </Text>
              )
            }
          >
            {u.message && (
              <Text size="sm" mt={4} className="gc-prose">
                {u.message}
              </Text>
            )}
            <Text size="xs" c="dimmed" mt={4}>
              {u.author.name}
              {u.author.title ? `, ${u.author.title}` : ''} · <When iso={u.created_at} />
            </Text>
          </Timeline.Item>
        );
      })}
    </Timeline>
  );
}
