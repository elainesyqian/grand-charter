import { Badge, Button, Group, Paper, Stack, Text, Textarea } from '@mantine/core';
import { IconLock } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { firmApi } from '../api/firm';
import type { AdminNote, NoteOut } from '../api/types';
import { Loading, LoadError, Section, When } from './ui';

export const PRIVATE_BG = 'var(--gc-private-bg)';
export const PRIVATE_BORDER = 'var(--gc-private-border)';

export function NoteCard({
  note,
  firmLabel,
}: {
  note: NoteOut | AdminNote;
  firmLabel?: React.ReactNode;
}) {
  return (
    <Paper p="sm" bg="white" style={{ borderColor: PRIVATE_BORDER }}>
      <Text size="sm" className="gc-prose">
        {note.body}
      </Text>
      <Group gap={6} mt={6}>
        <Text size="xs" c="dimmed">
          {note.author.name}
          {note.author.title ? `, ${note.author.title}` : ''} · <When iso={note.created_at} />
        </Text>
        {firmLabel}
      </Group>
    </Paper>
  );
}

/** Firm-private notes. Visually distinct from client-visible updates on purpose. */
export function NotesPanel({ caseId, firmName }: { caseId: number; firmName: string }) {
  const qc = useQueryClient();
  const queryKey = ['firm', 'case', caseId, 'notes'];
  const notes = useQuery({ queryKey, queryFn: () => firmApi.listNotes(caseId) });
  const [body, setBody] = useState('');

  const add = useMutation({
    mutationFn: () => firmApi.addNote(caseId, body.trim()),
    onSuccess: () => {
      setBody('');
      void qc.invalidateQueries({ queryKey });
    },
  });

  return (
    <Section
      title={
        <Group gap={8}>
          <IconLock size={18} />
          Private notes
        </Group>
      }
      description={`Only ${firmName} staff can see these. Never shown to the client.`}
      bg={PRIVATE_BG}
      borderColor={PRIVATE_BORDER}
    >
      <Stack gap="sm">
        <Textarea
          aria-label="New private note"
          placeholder="Add an internal note…"
          autosize
          minRows={2}
          maxRows={8}
          maxLength={10000}
          value={body}
          onChange={(e) => setBody(e.currentTarget.value)}
          styles={{ input: { background: 'white' } }}
        />
        <Group justify="space-between">
          <Badge color="yellow" variant="light" leftSection={<IconLock size={11} />}>
            Internal only
          </Badge>
          <Button
            size="sm"
            color="stone.8"
            disabled={!body.trim()}
            loading={add.isPending}
            onClick={() => add.mutate()}
          >
            Add note
          </Button>
        </Group>

        {notes.isPending ? (
          <Loading />
        ) : notes.isError ? (
          <LoadError error={notes.error} />
        ) : notes.data.items.length === 0 ? (
          <Text size="sm" c="dimmed">
            No notes yet.
          </Text>
        ) : (
          notes.data.items.map((n) => <NoteCard key={n.id} note={n} />)
        )}
      </Stack>
    </Section>
  );
}
