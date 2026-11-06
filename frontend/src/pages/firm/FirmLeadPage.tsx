import { Alert, Button, Chip, Grid, Group, Modal, Stack, Text, Textarea } from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { IconCheck, IconCircleCheck, IconX } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { firmApi } from '../../api/firm';
import { useUser } from '../../auth/AuthContext';
import { DocumentsPanel } from '../../components/DocumentsPanel';
import {
  Field,
  FieldGrid,
  LeadStatusBadge,
  Loading,
  LoadError,
  PageHeader,
  Section,
} from '../../components/ui';
import { CATEGORY_LABELS, REGION_LABELS, formatDateTime, leadNumber } from '../../lib/format';

const QUICK_REASONS = [
  'Outside our practice area',
  'Conflict of interest',
  'At capacity right now',
  'Not enough information',
];

export function DeclineModal({
  opened,
  onClose,
  onConfirm,
  loading,
}: {
  opened: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  loading: boolean;
}) {
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const error =
    touched && !reason.trim() ? 'Please give a reason so an admin can find a better fit' : null;

  return (
    <Modal opened={opened} onClose={onClose} title={<Text fw={600}>Decline this lead?</Text>}>
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          The lead goes back to an administrator to find another firm. Your firm will no longer see
          it. The plaintiff isn't told it was declined.
        </Text>
        <Group gap={6}>
          {QUICK_REASONS.map((r) => (
            <Chip
              key={r}
              size="xs"
              checked={reason === r}
              onChange={() => setReason(r)}
              variant="outline"
            >
              {r}
            </Chip>
          ))}
        </Group>
        <Textarea
          label="Reason"
          required
          autosize
          minRows={3}
          maxLength={2000}
          value={reason}
          onChange={(e) => setReason(e.currentTarget.value)}
          onBlur={() => setTouched(true)}
          error={error}
          data-autofocus
        />
        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={onClose}>
            Keep it
          </Button>
          <Button
            color="red"
            loading={loading}
            onClick={() => {
              setTouched(true);
              if (reason.trim()) onConfirm(reason.trim());
            }}
          >
            Decline lead
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

export function FirmLeadPage() {
  const id = Number(useParams().id);
  const user = useUser();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [declineOpen, setDeclineOpen] = useState(false);
  const lead = useQuery({ queryKey: ['firm', 'lead', id], queryFn: () => firmApi.getLead(id) });

  const accept = useMutation({
    mutationFn: () => firmApi.acceptLead(id),
    onSuccess: (c) => {
      void qc.invalidateQueries({ queryKey: ['firm'] });
      notifications.show({
        color: 'army',
        title: 'Lead accepted',
        message: `Case #${c.id} is open.`,
      });
      navigate(`/firm/cases/${c.id}`);
    },
  });
  const decline = useMutation({
    mutationFn: (reason: string) => firmApi.declineLead(id, reason),
    onSuccess: () => {
      setDeclineOpen(false);
      qc.removeQueries({ queryKey: ['firm', 'lead', id] });
      void qc.invalidateQueries({ queryKey: ['firm', 'leads'] });
      notifications.show({
        title: 'Lead declined',
        message: 'It has been returned to an administrator.',
      });
      navigate('/firm/inbox');
    },
  });

  if (lead.isPending) return <Loading />;
  if (lead.isError) return <LoadError error={lead.error} backTo="/firm/inbox" />;
  const l = lead.data;

  const confirmAccept = () =>
    modals.openConfirmModal({
      title: <Text fw={600}>Accept this lead?</Text>,
      children: (
        <Text size="sm" c="dimmed">
          A case will be opened for {user.firm?.name}. {l.name} will see that your firm is handling
          their matter.
        </Text>
      ),
      labels: { confirm: 'Accept and open case', cancel: 'Cancel' },
      confirmProps: { color: 'army.7' },
      onConfirm: () => accept.mutate(),
    });

  const actions =
    l.status === 'assigned' ? (
      <>
        <Button
          variant="default"
          leftSection={<IconX size={16} />}
          onClick={() => setDeclineOpen(true)}
        >
          Decline
        </Button>
        <Button
          color="army.7"
          leftSection={<IconCheck size={16} />}
          loading={accept.isPending}
          onClick={confirmAccept}
        >
          Accept
        </Button>
      </>
    ) : null;

  return (
    <>
      <PageHeader
        back={{ to: '/firm/inbox', label: 'Inbox' }}
        title={l.name}
        subtitle={`${leadNumber(l.id)} · ${CATEGORY_LABELS[l.category]} · ${REGION_LABELS[l.region]} · Received ${formatDateTime(l.created_at)}`}
        badge={<LeadStatusBadge status={l.status} />}
        actions={actions}
      />
      {l.case_id && (
        <Alert
          color="army"
          icon={<IconCircleCheck size={20} />}
          mb="lg"
          title="Your firm accepted this lead"
        >
          <Button
            component={Link}
            to={`/firm/cases/${l.case_id}`}
            size="xs"
            variant="white"
            color="army.8"
            mt={4}
          >
            Go to case #{l.case_id}
          </Button>
        </Alert>
      )}
      <Grid gap="lg">
        <Grid.Col span={{ base: 12, md: 7 }}>
          <Section title="Lead details">
            <Stack gap="lg">
              <FieldGrid>
                <Field label="Plaintiff">{l.name}</Field>
                <Field label="Email">{l.email}</Field>
                <Field label="Category">{CATEGORY_LABELS[l.category]}</Field>
                <Field label="Region">{REGION_LABELS[l.region]}</Field>
              </FieldGrid>
              <Field label="What happened">
                <span className="gc-prose">{l.description}</span>
              </Field>
            </Stack>
          </Section>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 5 }}>
          <DocumentsPanel
            viewer="firm"
            queryKey={['firm', 'lead', id, 'documents']}
            fetch={() => firmApi.listLeadDocuments(id)}
            description="Uploaded by the plaintiff."
          />
        </Grid.Col>
      </Grid>
      <DeclineModal
        opened={declineOpen}
        onClose={() => setDeclineOpen(false)}
        onConfirm={(reason) => decline.mutate(reason)}
        loading={decline.isPending}
      />
    </>
  );
}
