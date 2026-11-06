import { Alert, Grid, Group, Stack, Text } from '@mantine/core';
import { IconBuildingBank, IconHourglassHigh } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router';
import { plaintiffApi } from '../../api/plaintiff';
import { DocumentsPanel } from '../../components/DocumentsPanel';
import { UpdatesTimeline } from '../../components/UpdatesTimeline';
import {
  CaseStatusBadge,
  Field,
  FieldGrid,
  Loading,
  LoadError,
  PageHeader,
  PlaintiffStatusBadge,
  Section,
} from '../../components/ui';
import { CATEGORY_LABELS, REGION_LABELS, formatDate, recordNumber } from '../../lib/format';

export function LeadDetailPage() {
  const id = Number(useParams().id);
  const lead = useQuery({
    queryKey: ['plaintiff', 'lead', id],
    queryFn: () => plaintiffApi.getLead(id),
  });
  const updates = useQuery({
    queryKey: ['plaintiff', 'lead', id, 'updates'],
    queryFn: () => plaintiffApi.listUpdates(id),
    enabled: lead.isSuccess,
  });

  if (lead.isPending) return <Loading />;
  if (lead.isError) return <LoadError error={lead.error} backTo="/plaintiff" />;
  const l = lead.data;
  const closed = l.case_status === 'closed';

  return (
    <>
      <PageHeader
        back={{ to: '/plaintiff', label: 'My cases' }}
        title={CATEGORY_LABELS[l.category]}
        subtitle={`${recordNumber(l)} · ${REGION_LABELS[l.region]} · Submitted ${formatDate(l.created_at)}`}
        badge={
          <Group gap={6}>
            <PlaintiffStatusBadge status={l.display_status} />
            {l.case_status && <CaseStatusBadge status={l.case_status} />}
          </Group>
        }
      />

      {l.firm ? (
        <Alert
          color="army"
          variant="light"
          icon={<IconBuildingBank size={20} />}
          mb="lg"
          title={`${l.firm.name} is handling your case`}
        >
          They'll post updates here as your case progresses. You can share documents with them
          below.
        </Alert>
      ) : (
        <Alert
          color="navy"
          variant="light"
          icon={<IconHourglassHigh size={20} />}
          mb="lg"
          title="We're reviewing your lead"
        >
          We're connecting you with a law firm that handles this kind of case. You'll see here when
          a firm accepts it. In the meantime, you can add any documents that might help.
        </Alert>
      )}

      <Grid gap="lg">
        <Grid.Col span={{ base: 12, md: 7 }}>
          <Stack gap="lg">
            <Section title="Progress" description="Updates from your firm.">
              {updates.isPending ? (
                <Loading />
              ) : updates.isError ? (
                <LoadError error={updates.error} />
              ) : updates.data.items.length === 0 ? (
                <Text size="sm" c="dimmed">
                  {l.firm
                    ? 'No updates yet. Your firm will post them here.'
                    : 'Updates will appear here once a firm accepts your lead.'}
                </Text>
              ) : (
                <UpdatesTimeline updates={updates.data.items} />
              )}
            </Section>
            <Section title={l.case_id ? 'Your original lead' : 'Your lead'}>
              <Stack gap="md">
                <FieldGrid>
                  <Field label="Name">{l.name}</Field>
                  <Field label="Email">{l.email}</Field>
                  <Field label="Region">{REGION_LABELS[l.region]}</Field>
                </FieldGrid>
                <Field label="What happened">
                  <span className="gc-prose">{l.description}</span>
                </Field>
              </Stack>
            </Section>
          </Stack>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 5 }}>
          <DocumentsPanel
            viewer="plaintiff"
            queryKey={['plaintiff', 'lead', id, 'documents']}
            fetch={() => plaintiffApi.listDocuments(id)}
            upload={(file) => plaintiffApi.uploadDocument(id, file)}
            uploadDisabledReason={closed ? 'This case is closed' : null}
            description={
              l.firm
                ? `Shared with ${l.firm.name}. PDFs only, up to 10 MB.`
                : 'Shared with the firm that takes your case. PDFs only, up to 10 MB.'
            }
          />
        </Grid.Col>
      </Grid>
    </>
  );
}
