import { Anchor, Button, FileButton, Group, Stack, Text, ThemeIcon, Tooltip } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconExternalLink, IconFileTypePdf, IconUpload } from '@tabler/icons-react';
import { type QueryKey, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { documentUrl } from '../api/client';
import type { DocumentOut, Page } from '../api/types';
import { formatBytes } from '../lib/format';
import { Loading, LoadError, Section, When } from './ui';

export const MAX_UPLOAD_MB = 10;

/** Client-side check for a friendlier message; the server validates again. */
export function checkPdf(file: File): string | null {
  const looksPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  if (!looksPdf) return 'Only PDF files can be uploaded.';
  if (file.size === 0) return 'That file is empty.';
  if (file.size > MAX_UPLOAD_MB * 1024 * 1024)
    return `PDFs must be ${MAX_UPLOAD_MB} MB or smaller.`;
  return null;
}

function uploaderLabel(doc: DocumentOut, viewer: 'plaintiff' | 'firm' | 'admin') {
  if (doc.uploader_role === 'plaintiff') return viewer === 'plaintiff' ? 'You' : 'Plaintiff';
  return doc.uploader_firm?.name ?? 'Firm';
}

export function DocumentsPanel({
  queryKey,
  fetch,
  upload,
  uploadDisabledReason,
  viewer,
  description,
}: {
  queryKey: QueryKey;
  fetch: () => Promise<Page<DocumentOut>>;
  upload?: (file: File) => Promise<DocumentOut>;
  uploadDisabledReason?: string | null;
  viewer: 'plaintiff' | 'firm' | 'admin';
  description?: string;
}) {
  const qc = useQueryClient();
  const docs = useQuery({ queryKey, queryFn: fetch });
  const mutation = useMutation({
    mutationFn: (file: File) => upload!(file),
    onSuccess: (doc) => {
      notifications.show({ color: 'army', title: 'Uploaded', message: doc.filename });
      void qc.invalidateQueries({ queryKey });
    },
  });

  const onPick = (file: File | null) => {
    if (!file) return;
    const problem = checkPdf(file);
    if (problem) {
      notifications.show({ color: 'red', title: "Can't upload that file", message: problem });
      return;
    }
    mutation.mutate(file);
  };

  const uploadButton = upload && (
    <FileButton onChange={onPick} accept="application/pdf,.pdf">
      {(props) => (
        <Tooltip label={uploadDisabledReason} disabled={!uploadDisabledReason}>
          <Button
            {...props}
            variant="light"
            leftSection={<IconUpload size={16} />}
            loading={mutation.isPending}
            disabled={!!uploadDisabledReason}
          >
            Upload PDF
          </Button>
        </Tooltip>
      )}
    </FileButton>
  );

  return (
    <Section
      title="Documents"
      description={description ?? `PDFs only, up to ${MAX_UPLOAD_MB} MB.`}
      actions={uploadButton}
    >
      {docs.isPending ? (
        <Loading />
      ) : docs.isError ? (
        <LoadError error={docs.error} />
      ) : docs.data.items.length === 0 ? (
        <Text size="sm" c="dimmed">
          No documents yet.
        </Text>
      ) : (
        <Stack gap="xs">
          {docs.data.items.map((doc) => (
            <Group key={doc.id} gap="sm" wrap="nowrap" align="flex-start">
              <ThemeIcon variant="light" color="navy" size="lg">
                <IconFileTypePdf size={18} />
              </ThemeIcon>
              <div style={{ minWidth: 0 }}>
                <Anchor
                  href={documentUrl(doc.id)}
                  target="_blank"
                  rel="noopener"
                  size="sm"
                  fw={500}
                  style={{ wordBreak: 'break-all' }}
                >
                  {doc.filename} <IconExternalLink size={12} style={{ verticalAlign: 'middle' }} />
                </Anchor>
                <Text size="xs" c="dimmed">
                  {uploaderLabel(doc, viewer)} · <When iso={doc.created_at} /> ·{' '}
                  {formatBytes(doc.size_bytes)}
                </Text>
              </div>
            </Group>
          ))}
        </Stack>
      )}
    </Section>
  );
}
