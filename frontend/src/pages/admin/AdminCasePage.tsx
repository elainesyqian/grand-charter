import {
  Badge,
  Button,
  Grid,
  Group,
  Paper,
  Select,
  Stack,
  Tabs,
  Text,
  Title,
  Tooltip,
} from '@mantine/core';
import { IconArrowsExchange, IconBuildingBank, IconLock } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useParams } from 'react-router';
import { adminApi } from '../../api/admin';
import { AssignFirmModal, firmNameMap, useFirms } from '../../components/AssignFirmModal';
import { AuditTimeline } from '../../components/AuditTimeline';
import { DocumentsPanel } from '../../components/DocumentsPanel';
import { NoteCard, PRIVATE_BG, PRIVATE_BORDER } from '../../components/NotesPanel';
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
import { CATEGORY_LABELS, REGION_LABELS, formatDate } from '../../lib/format';
import { useReassignCase } from './useAssign';

function NotesTab({ caseId }: { caseId: number }) {
  const [firmId, setFirmId] = useState<string | null>(null);
  const all = useQuery({
    queryKey: ['admin', 'case', caseId, 'notes'],
    queryFn: () => adminApi.listNotes(caseId),
  });
  if (all.isPending) return <Loading />;
  if (all.isError) return <LoadError error={all.error} />;

  const authors = new Map(all.data.items.map((n) => [n.author_firm.id, n.author_firm.name]));
  const notes = all.data.items.filter((n) => !firmId || String(n.author_firm.id) === firmId);

  return (
    <Section
      title={
        <Group gap={8}>
          <IconLock size={18} />
          Private notes, all firms
        </Group>
      }
      description="Each note belongs to the firm that wrote it. Firms only see their own; plaintiffs see none."
      bg={PRIVATE_BG}
      borderColor={PRIVATE_BORDER}
      actions={
        authors.size > 1 && (
          <Select
            aria-label="Filter by firm"
            placeholder="All firms"
            clearable
            data={[...authors].map(([id, name]) => ({ value: String(id), label: name }))}
            value={firmId}
            onChange={setFirmId}
            w={200}
            styles={{ input: { background: 'white' } }}
          />
        )
      }
    >
      {notes.length === 0 ? (
        <Text size="sm" c="dimmed">
          No notes.
        </Text>
      ) : (
        <Stack gap="sm">
          {notes.map((n) => (
            <NoteCard
              key={n.id}
              note={n}
              firmLabel={
                <Group gap={4}>
                  <Badge size="xs" color="navy" variant="light">
                    {n.author_firm.name}
                  </Badge>
                  {n.from_previous_firm && (
                    <Tooltip label="This firm no longer holds the case and can't see this note anymore">
                      <Badge size="xs" color="orange" variant="light">
                        Previous firm
                      </Badge>
                    </Tooltip>
                  )}
                </Group>
              }
            />
          ))}
        </Stack>
      )}
    </Section>
  );
}

export function AdminCasePage() {
  const id = Number(useParams().id);
  const [reassignOpen, setReassignOpen] = useState(false);
  const firms = useFirms();
  const kase = useQuery({ queryKey: ['admin', 'case', id], queryFn: () => adminApi.getCase(id) });
  const updates = useQuery({
    queryKey: ['admin', 'case', id, 'updates'],
    queryFn: () => adminApi.listUpdates(id),
    enabled: kase.isSuccess,
  });
  const history = useQuery({
    queryKey: ['admin', 'case', id, 'history'],
    queryFn: () => adminApi.caseHistory(id),
    enabled: kase.isSuccess,
  });
  const reassign = useReassignCase(() => setReassignOpen(false));

  if (kase.isPending) return <Loading />;
  if (kase.isError) return <LoadError error={kase.error} backTo="/admin/cases" />;
  const c = kase.data;
  const closed = c.status === 'closed';

  return (
    <>
      <PageHeader
        back={{ to: '/admin/cases', label: 'Cases' }}
        title={`Case #${c.id} · ${c.plaintiff_name}`}
        subtitle={`${CATEGORY_LABELS[c.category]} · ${REGION_LABELS[c.region]} · Opened ${formatDate(c.created_at)}`}
        badge={<CaseStatusBadge status={c.status} />}
        actions={
          <Tooltip label="Closed cases can't be reassigned" disabled={!closed}>
            <Button
              leftSection={<IconArrowsExchange size={16} />}
              disabled={closed}
              onClick={() => setReassignOpen(true)}
            >
              Reassign case
            </Button>
          </Tooltip>
        }
      />
      <Grid gap="lg">
        <Grid.Col span={{ base: 12, md: 8 }}>
          <Tabs defaultValue="overview" keepMounted={false}>
            <Tabs.List mb="lg">
              <Tabs.Tab value="overview">Overview</Tabs.Tab>
              <Tabs.Tab value="notes">Private notes</Tabs.Tab>
              <Tabs.Tab value="documents">Documents</Tabs.Tab>
              <Tabs.Tab value="history">History</Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel value="overview">
              <Stack gap="lg">
                <Section title="Progress" description="Plaintiff-visible updates.">
                  {updates.isPending ? (
                    <Loading />
                  ) : updates.isError ? (
                    <LoadError error={updates.error} />
                  ) : updates.data.items.length === 0 ? (
                    <Text size="sm" c="dimmed">
                      No updates yet.
                    </Text>
                  ) : (
                    <UpdatesTimeline updates={updates.data.items} />
                  )}
                </Section>
                <Section title="Lead">
                  <Stack gap="lg">
                    <FieldGrid>
                      <Field label="Plaintiff">{c.plaintiff_name}</Field>
                      <Field label="Email">{c.plaintiff_email}</Field>
                      <Field label="Region">{REGION_LABELS[c.region]}</Field>
                    </FieldGrid>
                    <Field label="What happened">
                      <span className="gc-prose">{c.description}</span>
                    </Field>
                  </Stack>
                </Section>
              </Stack>
            </Tabs.Panel>
            <Tabs.Panel value="notes">
              <NotesTab caseId={c.id} />
            </Tabs.Panel>
            <Tabs.Panel value="documents">
              <DocumentsPanel
                viewer="admin"
                queryKey={['admin', 'case', id, 'documents']}
                fetch={() => adminApi.listCaseDocuments(id)}
                description="Documents travel with the case on reassignment."
              />
            </Tabs.Panel>
            <Tabs.Panel value="history">
              <Section title="History" description="The lead and the case, newest first.">
                {history.isPending ? (
                  <Loading />
                ) : history.isError ? (
                  <LoadError error={history.error} />
                ) : (
                  <AuditTimeline events={history.data.items} firmNames={firmNameMap(firms.data)} />
                )}
              </Section>
            </Tabs.Panel>
          </Tabs>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Paper p="lg">
            <Text size="xs" c="dimmed" tt="uppercase" fw={600} style={{ letterSpacing: '0.04em' }}>
              Handled by
            </Text>
            <Title order={3} mt={4}>
              <IconBuildingBank size={18} style={{ verticalAlign: '-2px', marginRight: 6 }} />
              {c.firm.name}
            </Title>
            <Text size="sm" c="dimmed" mt="sm">
              Only this firm's staff can see the case. Reassigning moves the case, its updates and
              documents to the new firm.
            </Text>
          </Paper>
        </Grid.Col>
      </Grid>
      <AssignFirmModal
        opened={reassignOpen}
        onClose={() => setReassignOpen(false)}
        kind="case"
        currentFirm={c.firm}
        loading={reassign.isPending}
        onConfirm={(firmId, reason) => reassign.mutate({ caseId: c.id, firmId, reason })}
      />
    </>
  );
}
