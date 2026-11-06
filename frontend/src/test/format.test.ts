import { describe, expect, it } from 'vitest';
import { ApiError } from '../api/client';
import type { AuditEventOut } from '../api/types';
import { describeEvent } from '../components/AuditTimeline';

const event = (overrides: Partial<AuditEventOut>): AuditEventOut => ({
  id: 1,
  actor: null,
  entity_type: 'case',
  entity_id: 7,
  action: 'case.reassigned',
  before: null,
  after: null,
  reason: null,
  created_at: '2026-11-02T10:00:00Z',
  ...overrides,
});

describe('audit event descriptions', () => {
  const names = new Map([
    [1, 'Alley & Deering LLP'],
    [2, 'Hayes & Teale LLP'],
  ]);

  it('names both firms on a reassignment', () => {
    const d = describeEvent(event({ before: { firm_id: 1 }, after: { firm_id: 2 } }), names);
    expect(d.text).toBe('Case moved from Alley & Deering LLP to Hayes & Teale LLP');
  });

  it('uses readable status labels', () => {
    const d = describeEvent(
      event({
        action: 'case.status_changed',
        before: { status: 'open' },
        after: { status: 'in_progress' },
      }),
      names,
    );
    expect(d.text).toBe('Status changed: Open → In progress');
  });

  it('falls back to the firm id when the name is unknown', () => {
    const d = describeEvent(
      event({ action: 'lead.routed', entity_type: 'lead', after: { firm_id: 99 } }),
      names,
    );
    expect(d.text).toBe('Automatically routed to Firm #99');
  });
});

describe('ApiError', () => {
  it('uses a string detail as the message', () => {
    expect(new ApiError(409, 'Lead was changed').message).toBe('Lead was changed');
  });

  it('summarises FastAPI validation errors', () => {
    const err = new ApiError(422, [{ loc: ['body', 'reason'], msg: 'Field required' }]);
    expect(err.message).toBe('reason: Field required');
  });
});
