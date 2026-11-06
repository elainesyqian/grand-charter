import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import type {
  CaseStatus,
  Category,
  LeadStatus,
  PlaintiffLeadStatus,
  Region,
  Role,
} from '../api/types';

dayjs.extend(relativeTime);

export const CATEGORY_LABELS: Record<Category, string> = {
  personal_injury: 'Personal injury',
  employment: 'Employment',
  family: 'Family',
  immigration: 'Immigration',
  real_estate: 'Real estate',
  criminal_defense: 'Criminal defense',
};

export const REGION_LABELS: Record<Region, string> = {
  northeast: 'Northeast',
  southeast: 'Southeast',
  midwest: 'Midwest',
  southwest: 'Southwest',
  west: 'West',
};

type BadgeStyle = { label: string; color: string };

export const LEAD_STATUS: Record<LeadStatus, BadgeStyle> = {
  unassigned: { label: 'Unassigned', color: 'orange' },
  assigned: { label: 'Awaiting decision', color: 'navy' },
  declined: { label: 'Declined', color: 'red' },
  accepted: { label: 'Accepted', color: 'army' },
};

export const CASE_STATUS: Record<CaseStatus, BadgeStyle> = {
  open: { label: 'Open', color: 'army' },
  in_progress: { label: 'In progress', color: 'navy' },
  on_hold: { label: 'On hold', color: 'yellow' },
  closed: { label: 'Closed', color: 'stone' },
};

export const PLAINTIFF_STATUS: Record<PlaintiffLeadStatus, BadgeStyle> = {
  under_review: { label: 'Under review', color: 'navy' },
  accepted: { label: 'Accepted', color: 'army' },
};

export const ROLE_LABELS: Record<Role, string> = {
  plaintiff: 'Plaintiff',
  staff: 'Firm staff',
  admin: 'Administrator',
};

export const CASE_STATUS_ORDER: CaseStatus[] = ['open', 'in_progress', 'on_hold', 'closed'];

export const categoryOptions = Object.entries(CATEGORY_LABELS).map(([value, label]) => ({
  value,
  label,
}));
export const regionOptions = Object.entries(REGION_LABELS).map(([value, label]) => ({
  value,
  label,
}));

export const formatDate = (iso: string) => dayjs(iso).format('MMM D, YYYY');
export const formatDateTime = (iso: string) => dayjs(iso).format('MMM D, YYYY · h:mm A');
export const fromNow = (iso: string) => dayjs(iso).fromNow();

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const caseNumber = (id: number) => `Case #${id}`;
export const leadNumber = (id: number) => `Lead #${id}`;

/** A case keeps its lead's number, so only the word changes once a firm accepts. */
export const recordNumber = (r: { id: number; case_id: number | null }) =>
  r.case_id ? `Case #${r.case_id}` : leadNumber(r.id);
