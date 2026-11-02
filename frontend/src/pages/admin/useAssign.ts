import { notifications } from '@mantine/notifications';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../api/admin';

/** Assign/move a lead; refreshes every admin view and nav counter. */
export function useAssignLead(onDone?: () => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { leadId: number; firmId: number; reason: string | null }) =>
      adminApi.assignLead(v.leadId, { firm_id: v.firmId, reason: v.reason }),
    onSuccess: (lead) => {
      void qc.invalidateQueries({ queryKey: ['admin'] });
      notifications.show({
        color: 'army',
        title: 'Lead assigned',
        message: `Request #${lead.id} is now with ${lead.firm?.name}.`,
      });
      onDone?.();
    },
  });
}

export function useReassignCase(onDone?: () => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { caseId: number; firmId: number; reason: string | null }) =>
      adminApi.reassignCase(v.caseId, { firm_id: v.firmId, reason: v.reason }),
    onSuccess: (c) => {
      void qc.invalidateQueries({ queryKey: ['admin'] });
      notifications.show({
        color: 'army',
        title: 'Case reassigned',
        message: `Case #${c.id} is now with ${c.firm.name}.`,
      });
      onDone?.();
    },
  });
}
