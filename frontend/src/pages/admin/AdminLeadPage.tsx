import { Alert, Button, Grid, Paper, Stack, Text, Title } from '@mantine/core';
import {
  IconArrowsExchange,
  IconBuildingBank,
  IconCircleCheck,
  IconUserPlus,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { adminApi } from '../../api/admin';
import { AssignFirmModal, firmNameMap, useFirms } from '../../components/AssignFirmModal';
import { AuditTimeline } from '../../components/AuditTimeline';
import { DocumentsPanel } from '../../components/DocumentsPanel';
import {
  Field,
  FieldGrid,
  LeadStatusBadge,
  Loading,
  LoadError,
  PageHeader,
  Section,
  When,
} from '../../components/ui';
import { CATEGORY_LABELS, REGION_LABELS, formatDateTime, leadNumber } from '../../lib/format';
import { useAssignLead } from './useAssign';

export function AdminLeadPage() {
  const id = Number(useParams().id);
  const [assignOpen, setAssignOpen] = useState(false);
  const firms = useFirms();
  const lead = useQuery({ queryKey: ['admin', 'lead', id], queryFn: () => adminApi.getLead(id) });
  const history = useQuery({
    queryKey: ['admin', 'lead', id, 'history'],
    queryFn: () => adminApi.leadHistory(id),
    enabled: lead.isSuccess,
  });
  const assign = useAssignLead(() => setAssignOpen(false));

  if (lead.isPending) return <Loading />;
  if (lead.isError) return <LoadError error={lead.error} backTo="/admin/leads" />;
  const l = lead.data;
  const canAssign = l.status !== 'accepted';

  return (
    <>
      <PageHeader
        back={{ to: '/admin/leads', label: 'Leads' }}
        title={l.name}
        subtitle={`${leadNumber(l.id)} · ${CATEGORY_LABELS[l.category]} · ${REGION_LABELS[l.region]} · Received ${formatDateTime(l.created_at)}`}
        badge={<LeadStatusBadge status={l.status} />}
        actions={
          canAssign ? (
            <Button
              leftSection={l.firm ? <IconArrowsExchange size={16} /> : <IconUserPlus size={16} />}
              onClick={() => setAssignOpen(true)}
            >
              {l.firm ? 'Move to another firm' : 'Assign to a firm'}
            </Button>
          ) : (
            l.case_id && (
              <Button component={Link} to={`/admin/cases/${l.case_id}`} variant="light">
                Open case #{l.case_id}
              </Button>
            )
          )
        }
      />
      {l.case_id && (
        <Alert
          color="army"
          icon={<IconCircleCheck size={20} />}
          mb="lg"
          title="Accepted. This request has a case."
        >
          To move it to another firm, reassign the case. Its documents and progress go with it.
        </Alert>
      )}
      <Grid gap="lg">
        <Grid.Col span={{ base: 12, md: 7 }}>
          <Stack gap="lg">
            <Section title="Request details">
              <Stack gap="lg">
                <FieldGrid>
                  <Field label="Client">{l.name}</Field>
                  <Field label="Email">{l.email}</Field>
                  <Field label="Account">{l.plaintiff.name}</Field>
                  <Field label="Category">{CATEGORY_LABELS[l.category]}</Field>
                  <Field label="Region">{REGION_LABELS[l.region]}</Field>
                </FieldGrid>
                <Field label="What happened">
                  <span className="gc-prose">{l.description}</span>
                </Field>
              </Stack>
            </Section>
            <Section
              title="History"
              description="Every assignment and status change, newest first."
            >
              {history.isPending ? (
                <Loading />
              ) : history.isError ? (
                <LoadError error={history.error} />
              ) : (
                <AuditTimeline events={history.data.items} firmNames={firmNameMap(firms.data)} />
              )}
            </Section>
          </Stack>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 5 }}>
          <Stack gap="lg">
            <Paper p="lg">
              <Text
                size="xs"
                c="dimmed"
                tt="uppercase"
                fw={600}
                style={{ letterSpacing: '0.04em' }}
              >
                Current firm
              </Text>
              {l.firm ? (
                <Title order={3} mt={4}>
                  <IconBuildingBank size={18} style={{ verticalAlign: '-2px', marginRight: 6 }} />
                  {l.firm.name}
                </Title>
              ) : (
                <Text mt={4} c="dimmed">
                  No firm.{' '}
                  {l.status === 'declined' ? 'It was declined.' : 'Nothing matched automatically.'}
                </Text>
              )}
            </Paper>
            {l.declines.length > 0 && (
              <Section title="Declines" description="Firms that turned this request down.">
                <Stack gap="sm">
                  {l.declines.map((d) => (
                    <Paper
                      key={d.id}
                      p="sm"
                      bg="red.0"
                      style={{ borderColor: 'var(--mantine-color-red-1)' }}
                    >
                      <Text size="sm" fw={600}>
                        {d.firm.name}
                      </Text>
                      <Text size="sm" className="gc-prose">
                        “{d.reason}”
                      </Text>
                      <Text size="xs" c="dimmed" mt={4}>
                        {d.user.name} · <When iso={d.created_at} />
                      </Text>
                    </Paper>
                  ))}
                </Stack>
              </Section>
            )}
            <DocumentsPanel
              viewer="admin"
              queryKey={['admin', 'lead', id, 'documents']}
              fetch={() => adminApi.listLeadDocuments(id)}
              description="Shared between the client and the firm."
            />
          </Stack>
        </Grid.Col>
      </Grid>
      <AssignFirmModal
        opened={assignOpen}
        onClose={() => setAssignOpen(false)}
        kind="lead"
        currentFirm={l.firm}
        declines={l.declines}
        loading={assign.isPending}
        onConfirm={(firmId, reason) => assign.mutate({ leadId: l.id, firmId, reason })}
      />
    </>
  );
}
