import { Alert, Button, Group, Modal, Select, Stack, Text, Textarea } from '@mantine/core';
import { IconAlertTriangle, IconInfoCircle } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { adminApi } from '../api/admin';
import type { DeclineOut, FirmRef } from '../api/types';
import { formatDate } from '../lib/format';

export const useFirms = () =>
  useQuery({ queryKey: ['admin', 'firms'], queryFn: adminApi.firms, staleTime: 5 * 60_000 });

export function firmNameMap(firms: FirmRef[] | undefined): Map<number, string> {
  return new Map((firms ?? []).map((f) => [f.id, f.name]));
}

/**
 * Pick a firm (searchable: there can be 100+), optionally give a reason, confirm.
 * Used to resolve/move a lead and to reassign a case.
 */
export function AssignFirmModal({
  opened,
  onClose,
  kind,
  currentFirm,
  declines = [],
  onConfirm,
  loading,
}: {
  opened: boolean;
  onClose: () => void;
  kind: 'lead' | 'case';
  currentFirm: FirmRef | null;
  declines?: DeclineOut[];
  onConfirm: (firmId: number, reason: string | null) => void;
  loading: boolean;
}) {
  const firms = useFirms();
  const [firmId, setFirmId] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  const close = () => {
    setFirmId(null);
    setReason('');
    onClose();
  };

  const options = (firms.data ?? [])
    .filter((f) => f.id !== currentFirm?.id)
    .map((f) => ({ value: String(f.id), label: f.name }));
  const chosen = firms.data?.find((f) => String(f.id) === firmId);
  const priorDecline = chosen && [...declines].reverse().find((d) => d.firm.id === chosen.id);

  const title =
    kind === 'case' ? 'Reassign case' : currentFirm ? 'Move to another firm' : 'Assign to a firm';

  return (
    <Modal opened={opened} onClose={close} title={<Text fw={600}>{title}</Text>} size="md">
      <Stack gap="md">
        {currentFirm && (
          <Text size="sm" c="dimmed">
            Currently with <b>{currentFirm.name}</b>.
          </Text>
        )}
        <Select
          label="Firm"
          placeholder={firms.isPending ? 'Loading firms…' : 'Search firms'}
          data={options}
          value={firmId}
          onChange={setFirmId}
          searchable
          nothingFoundMessage="No firm with that name"
          comboboxProps={{ shadow: 'md', withinPortal: true }}
          maxDropdownHeight={260}
        />
        {priorDecline && (
          <Alert
            color="orange"
            icon={<IconAlertTriangle size={18} />}
            title="This firm declined it before"
          >
            {priorDecline.firm.name} declined on {formatDate(priorDecline.created_at)}: “
            {priorDecline.reason}”
          </Alert>
        )}
        {kind === 'case' && currentFirm && (
          <Alert color="navy" variant="light" icon={<IconInfoCircle size={18} />}>
            {currentFirm.name} will lose access immediately. The new firm gets the case, its
            progress updates and all documents. {currentFirm.name}'s private notes stay with them
            and remain visible to admins.
          </Alert>
        )}
        <Textarea
          label="Reason"
          description="Optional, but it helps anyone reading the history later."
          placeholder={
            kind === 'case'
              ? 'e.g. Conflict of interest at the current firm'
              : 'e.g. Best fit for this region'
          }
          autosize
          minRows={2}
          maxLength={2000}
          value={reason}
          onChange={(e) => setReason(e.currentTarget.value)}
        />
        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={close}>
            Cancel
          </Button>
          <Button
            disabled={!chosen}
            loading={loading}
            onClick={() => chosen && onConfirm(chosen.id, reason.trim() || null)}
          >
            {chosen
              ? `${kind === 'case' ? 'Move case' : 'Assign'} to ${chosen.name}`
              : 'Choose a firm'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
