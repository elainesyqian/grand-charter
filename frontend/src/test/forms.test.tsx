import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { checkPdf } from '../components/DocumentsPanel';
import { DeclineModal } from '../pages/firm/FirmLeadPage';
import { validateLead } from '../pages/plaintiff/NewLeadPage';
import { mockApi, renderWithProviders } from './utils';

describe('lead form validation', () => {
  const valid = {
    name: 'Jordan',
    email: 'j@example.com',
    region: 'west' as const,
    category: 'family' as const,
    description: 'Something happened',
  };

  it('accepts a complete form', () => {
    expect(validateLead(valid)).toEqual({});
  });

  it('flags every missing or invalid field', () => {
    const errors = validateLead({
      name: ' ',
      email: 'nope',
      region: null,
      category: null,
      description: '  ',
    });
    expect(Object.keys(errors).sort()).toEqual([
      'category',
      'description',
      'email',
      'name',
      'region',
    ]);
  });
});

describe('PDF upload check', () => {
  const file = (name: string, type: string, size: number) => {
    const f = new File(['x'], name, { type });
    Object.defineProperty(f, 'size', { value: size });
    return f;
  };

  it('allows a normal PDF', () => {
    expect(checkPdf(file('a.pdf', 'application/pdf', 1000))).toBeNull();
  });

  it('rejects other types, empty files and oversized files', () => {
    expect(checkPdf(file('a.png', 'image/png', 1000))).toMatch(/Only PDF/);
    expect(checkPdf(file('a.pdf', 'application/pdf', 0))).toMatch(/empty/);
    expect(checkPdf(file('a.pdf', 'application/pdf', 11 * 1024 * 1024))).toMatch(/10 MB/);
  });
});

describe('DeclineModal', () => {
  it('requires a reason before declining', async () => {
    mockApi({ '/api/auth/me': { status: 401 } });
    const onConfirm = vi.fn();
    renderWithProviders(
      <DeclineModal opened onClose={() => {}} onConfirm={onConfirm} loading={false} />,
    );
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Decline request' }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByText(/Please give a reason/)).toBeInTheDocument();

    await user.click(screen.getByText('Conflict of interest'));
    await user.click(screen.getByRole('button', { name: 'Decline request' }));
    expect(onConfirm).toHaveBeenCalledWith('Conflict of interest');
  });
});
