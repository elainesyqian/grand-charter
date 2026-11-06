import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { NoteOut } from '../api/types';
import { NotesPanel } from '../components/NotesPanel';
import { renderWithProviders } from './utils';

const note = (id: number): NoteOut => ({
  id,
  body: `Note number ${id}`,
  author: { id: 4, name: 'Ana Deering', role: 'staff', title: 'Attorney' },
  created_at: '2026-11-02T10:00:00Z',
});

/** 120 notes, newest first, served in pages like the real API. */
function mockNotesApi(total = 120) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = new URL(String(input), 'http://localhost');
    const page = Number(url.searchParams.get('page') ?? 1);
    const pageSize = Number(url.searchParams.get('page_size') ?? 20);
    const ids = Array.from({ length: total }, (_, i) => total - i);
    const items = ids.slice((page - 1) * pageSize, page * pageSize).map(note);
    const body = { items, total, page, page_size: pageSize };
    return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
  });
}

describe('long sub-lists', () => {
  it('shows the newest page first and loads older ones on demand', async () => {
    const fetchSpy = mockNotesApi();
    renderWithProviders(<NotesPanel caseId={8} firmName="Alley & Deering LLP" />);

    expect(await screen.findByText('Note number 120')).toBeInTheDocument();
    expect(screen.queryByText('Note number 70')).not.toBeInTheDocument();
    expect(screen.getByText('Showing 50 of 120 notes')).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Show older' }));
    expect(await screen.findByText('Note number 70')).toBeInTheDocument();
    expect(screen.getByText('Showing 100 of 120 notes')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Show older' }));
    expect(await screen.findByText('Note number 1')).toBeInTheDocument();
    // Everything is loaded, so the button goes away.
    expect(screen.queryByRole('button', { name: 'Show older' })).not.toBeInTheDocument();
    const notePages = fetchSpy.mock.calls
      .map(([u]) => new URL(String(u), 'http://x'))
      .filter((u) => u.pathname.endsWith('/notes'))
      .map((u) => u.searchParams.get('page'));
    expect(notePages).toEqual(['1', '2', '3']);
  });

  it('shows no button when everything fits on one page', async () => {
    mockNotesApi(3);
    renderWithProviders(<NotesPanel caseId={8} firmName="Alley & Deering LLP" />);
    expect(await screen.findByText('Note number 3')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Show older' })).not.toBeInTheDocument();
  });
});
