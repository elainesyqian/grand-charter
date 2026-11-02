import { Alert, Badge, Button, Grid, Group, Select, Stack, Text, Textarea } from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { IconEye, IconLock } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useParams } from 'react-router';
import { firmApi } from '../../api/firm';
import type { CaseStatus, FirmCaseDetail } from '../../api/types';
import { useUser } from '../../auth/AuthContext';
import { DocumentsPanel } from '../../components/DocumentsPanel';
import { NotesPanel } from '../../components/NotesPanel';
import { UpdatesTimeline } from '../../components/UpdatesTimeline';
import {
  CaseStatusBadge,
  Field,
  FieldGrid,
  Loading,
  LoadError,
  PageHeader,
  Section,
} from '../../components/ui';
import {
  CASE_STATUS,
  CASE_STATUS_ORDER,
  CATEGORY_LABELS,
  REGION_LABELS,
  formatDate,
} from '../../lib/format';

function UpdateComposer({ c }: { c: FirmCaseDetail }) {
  const qc = useQueryClient();
  const [status, setStatus] = useState<CaseStatus>(c.status);
  const [message, setMessage] = useState('');

  const post = useMutation({
    mutationFn: () =>
      firmApi.addUpdate(c.id, {
        to_status: status !== c.status ? status : null,
        message: message.trim() || null,
      }),
    onSuccess: () => {
      setMessage('');
      void qc.invalidateQueries({ queryKey: ['firm', 'case', c.id] });
      void qc.invalidateQueries({ queryKey: ['firm', 'cases'] });
      notifications.show({
        color: 'army',
        title: 'Update posted',
        message: 'The client can now see it.',
      });
    },
  });

  const changing = status !== c.status;
  const canPost = changing || !!message.trim();

  const submit = () => {
    if (status === 'closed') {
      modals.openConfirmModal({
        title: <Text fw={600}>Close this case?</Text>,
        children: (
          <Text size="sm" c="dimmed">
            Closing is final. The case becomes read-only: no more updates or uploads, and it can't
            be reassigned. Private notes can still be added.
          </Text>
        ),
        labels: { confirm: 'Close case', cancel: 'Keep open' },
        confirmProps: { color: 'red' },
        onConfirm: () => post.mutate(),
      });
    } else post.mutate();
  };

  return (
    <Section
      title="Post an update"
      description="Keep your client informed."
      actions={
        <Badge color="army" leftSection={<IconEye size={12} />}>
          Visible to client
        </Badge>
      }
    >
      <Stack gap="sm">
        <Select
          label="Status"
          data={CASE_STATUS_ORDER.map((s) => ({
            value: s,
            label: s === c.status ? `${CASE_STATUS[s].label} (current)` : CASE_STATUS[s].label,
          }))}
          value={status}
          onChange={(v) => v && setStatus(v as CaseStatus)}
          allowDeselect={false}
          w={{ base: '100%', xs: 240 }}
        />
        <Textarea
          label="Message to client"
          placeholder="e.g. We've sent a demand letter to the insurer and expect a reply within 30 days."
          autosize
          minRows={3}
          maxRows={10}
          maxLength={5000}
          value={message}
          onChange={(e) => setMessage(e.currentTarget.value)}
        />
        <Group justify="flex-end">
          <Button disabled={!canPost} loading={post.isPending} onClick={submit}>
            {changing
              ? `Post update & mark ${CASE_STATUS[status].label.toLowerCase()}`
              : 'Post update'}
          </Button>
        </Group>
      </Stack>
    </Section>
  );
}

export function FirmCasePage() {
  const id = Number(useParams().id);
  const user = useUser();
  const kase = useQuery({ queryKey: ['firm', 'case', id], queryFn: () => firmApi.getCase(id) });
  const updates = useQuery({
    queryKey: ['firm', 'case', id, 'updates'],
    queryFn: () => firmApi.listUpdates(id),
    enabled: kase.isSuccess,
  });

  if (kase.isPending) return <Loading />;
  if (kase.isError) return <LoadError error={kase.error} backTo="/firm/cases" />;
  const c = kase.data;
  const closed = c.status === 'closed';
  const firmName = user.firm?.name ?? 'your firm';

  return (
    <>
      <PageHeader
        back={{ to: '/firm/cases', label: 'Cases' }}
        title={`Case #${c.id} · ${c.plaintiff_name}`}
        subtitle={`${CATEGORY_LABELS[c.category]} · ${REGION_LABELS[c.region]} · Opened ${formatDate(c.created_at)}`}
        badge={<CaseStatusBadge status={c.status} />}
      />
      {closed && (
        <Alert color="stone" icon={<IconLock size={18} />} mb="lg" title="This case is closed">
          It's read-only now: no more client updates or uploads. You can still add private notes.
        </Alert>
      )}
      <Grid gap="lg">
        <Grid.Col span={{ base: 12, md: 7 }}>
          <Stack gap="lg">
            {!closed && <UpdateComposer key={c.status} c={c} />}
            <Section title="Progress" description="What your client sees, newest first.">
              {updates.isPending ? (
                <Loading />
              ) : updates.isError ? (
                <LoadError error={updates.error} />
              ) : updates.data.items.length === 0 ? (
                <Text size="sm" c="dimmed">
                  No updates yet. Post one to let your client know where things stand.
                </Text>
              ) : (
                <UpdatesTimeline updates={updates.data.items} />
              )}
            </Section>
            <Section title="Client & request">
              <Stack gap="lg">
                <FieldGrid>
                  <Field label="Client">{c.plaintiff_name}</Field>
                  <Field label="Email">{c.plaintiff_email}</Field>
                  <Field label="Original request">#{c.lead_id}</Field>
                </FieldGrid>
                <Field label="What happened">
                  <span className="gc-prose">{c.description}</span>
                </Field>
              </Stack>
            </Section>
          </Stack>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 5 }}>
          <Stack gap="lg">
            <NotesPanel caseId={c.id} firmName={firmName} />
            <DocumentsPanel
              viewer="firm"
              queryKey={['firm', 'case', id, 'documents']}
              fetch={() => firmApi.listDocuments(id)}
              upload={(file) => firmApi.uploadDocument(id, file)}
              uploadDisabledReason={closed ? 'This case is closed' : null}
              description="Shared with the client. PDFs only, up to 10 MB."
            />
          </Stack>
        </Grid.Col>
      </Grid>
    </>
  );
}
