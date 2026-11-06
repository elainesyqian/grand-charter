import { Anchor, Group, Text, Timeline } from '@mantine/core';
import {
  IconArrowsExchange,
  IconBolt,
  IconCheck,
  IconCircleDot,
  IconInbox,
  IconQuestionMark,
  IconX,
} from '@tabler/icons-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import type { AuditEventOut, CaseStatus } from '../api/types';
import { CASE_STATUS } from '../lib/format';
import { When } from './ui';

type FirmNames = Map<number, string>;

const firm = (names: FirmNames, id: unknown) =>
  typeof id === 'number' ? (names.get(id) ?? `Firm #${id}`) : 'no firm';

/** Plain-English summary of an audit event. */
export function describeEvent(
  e: AuditEventOut,
  names: FirmNames,
): { text: string; color: string; icon: ReactNode } {
  const before = e.before ?? {};
  const after = e.after ?? {};
  switch (e.action) {
    case 'lead.created':
      return { text: 'Lead submitted', color: 'navy', icon: <IconInbox size={14} /> };
    case 'lead.routed':
      return {
        text: `Automatically routed to ${firm(names, after.firm_id)}`,
        color: 'navy',
        icon: <IconBolt size={14} />,
      };
    case 'lead.unmatched':
      return {
        text: 'No firm matches this category and region; waiting for an admin',
        color: 'orange',
        icon: <IconQuestionMark size={14} />,
      };
    case 'lead.assigned':
      return {
        text: before.firm_id
          ? `Moved from ${firm(names, before.firm_id)} to ${firm(names, after.firm_id)}`
          : `Assigned to ${firm(names, after.firm_id)}`,
        color: 'navy',
        icon: <IconArrowsExchange size={14} />,
      };
    case 'lead.accepted':
      return { text: 'Accepted by the firm', color: 'army', icon: <IconCheck size={14} /> };
    case 'lead.declined':
      return {
        text: `Declined by ${firm(names, before.firm_id)}`,
        color: 'red',
        icon: <IconX size={14} />,
      };
    case 'case.created':
      return {
        text: `Case #${e.entity_id} opened`,
        color: 'army',
        icon: <IconCircleDot size={14} />,
      };
    case 'case.status_changed': {
      const from = CASE_STATUS[before.status as CaseStatus]?.label ?? String(before.status);
      const to = CASE_STATUS[after.status as CaseStatus]?.label ?? String(after.status);
      return {
        text: `Status changed: ${from} → ${to}`,
        color: 'navy',
        icon: <IconArrowsExchange size={14} />,
      };
    }
    case 'case.reassigned':
      return {
        text: `Case moved from ${firm(names, before.firm_id)} to ${firm(names, after.firm_id)}`,
        color: 'orange',
        icon: <IconArrowsExchange size={14} />,
      };
  }
}

export function entityLink(e: AuditEventOut) {
  return e.entity_type === 'lead' ? `/admin/leads/${e.entity_id}` : `/admin/cases/${e.entity_id}`;
}

export function actorLabel(e: AuditEventOut) {
  if (!e.actor) return 'System';
  return e.actor.title ? `${e.actor.name}, ${e.actor.title}` : e.actor.name;
}

export function AuditTimeline({
  events,
  firmNames,
}: {
  events: AuditEventOut[];
  firmNames: FirmNames;
}) {
  return (
    <Timeline bulletSize={26} lineWidth={2}>
      {events.map((e) => {
        const d = describeEvent(e, firmNames);
        return (
          <Timeline.Item
            key={e.id}
            color={d.color}
            bullet={d.icon}
            title={
              <Text size="sm" fw={600}>
                {d.text}
              </Text>
            }
          >
            {e.reason && (
              <Text size="sm" mt={4} className="gc-prose">
                “{e.reason}”
              </Text>
            )}
            <Group gap={6} mt={4}>
              <Text size="xs" c="dimmed">
                {actorLabel(e)} · <When iso={e.created_at} />
              </Text>
              <Anchor component={Link} to={entityLink(e)} size="xs" c="dimmed">
                {e.entity_type === 'lead' ? `Lead #${e.entity_id}` : `Case #${e.entity_id}`}
              </Anchor>
            </Group>
          </Timeline.Item>
        );
      })}
    </Timeline>
  );
}
