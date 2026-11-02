// Mirrors backend/app/schemas. Keep in sync with the API (see /docs when the backend runs).

export type Role = 'plaintiff' | 'staff' | 'admin';
export type Region = 'northeast' | 'southeast' | 'midwest' | 'southwest' | 'west';
export type Category =
  'personal_injury' | 'employment' | 'family' | 'immigration' | 'real_estate' | 'criminal_defense';
export type LeadStatus = 'unassigned' | 'assigned' | 'declined' | 'accepted';
export type CaseStatus = 'open' | 'in_progress' | 'on_hold' | 'closed';
export type PlaintiffLeadStatus = 'under_review' | 'accepted';
export type EntityType = 'lead' | 'case';
export type AuditAction =
  | 'lead.created'
  | 'lead.routed'
  | 'lead.unmatched'
  | 'lead.assigned'
  | 'lead.accepted'
  | 'lead.declined'
  | 'case.created'
  | 'case.status_changed'
  | 'case.reassigned';

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface FirmRef {
  id: number;
  name: string;
}

export interface UserRef {
  id: number;
  name: string;
  role: Role;
  title: string | null;
}

export interface Me {
  id: number;
  name: string;
  email: string;
  role: Role;
  title: string | null;
  firm: FirmRef | null;
}

export type DemoUser = Omit<Me, 'id'>;

export interface Meta {
  regions: Region[];
  categories: Category[];
  lead_statuses: LeadStatus[];
  case_statuses: CaseStatus[];
}

export interface DocumentOut {
  id: number;
  filename: string;
  size_bytes: number;
  uploader_role: Role;
  uploader_firm: FirmRef | null;
  created_at: string;
}

export interface CaseUpdateOut {
  id: number;
  author: UserRef;
  from_status: CaseStatus | null;
  to_status: CaseStatus | null;
  message: string | null;
  created_at: string;
}

export interface AuditEventOut {
  id: number;
  actor: UserRef | null;
  entity_type: EntityType;
  entity_id: number;
  action: AuditAction;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  reason: string | null;
  created_at: string;
}

// Plaintiff
export interface LeadCreate {
  name: string;
  email: string;
  region: Region;
  category: Category;
  description: string;
}

export interface PlaintiffLeadSummary {
  id: number;
  category: Category;
  region: Region;
  created_at: string;
  display_status: PlaintiffLeadStatus;
  case_id: number | null;
  case_status: CaseStatus | null;
}

export interface PlaintiffLeadDetail extends PlaintiffLeadSummary {
  name: string;
  email: string;
  description: string;
  firm: FirmRef | null;
}

// Firm
export interface InboxLead {
  id: number;
  name: string;
  category: Category;
  region: Region;
  status: LeadStatus;
  created_at: string;
}

export interface FirmLeadDetail extends InboxLead {
  email: string;
  description: string;
  case_id: number | null;
}

export interface FirmCaseSummary {
  id: number;
  lead_id: number;
  plaintiff_name: string;
  category: Category;
  region: Region;
  status: CaseStatus;
  created_at: string;
  updated_at: string;
}

export interface FirmCaseDetail extends FirmCaseSummary {
  plaintiff_email: string;
  description: string;
}

export interface NoteOut {
  id: number;
  author: UserRef;
  body: string;
  created_at: string;
}

// Admin
export interface AdminLead {
  id: number;
  name: string;
  email: string;
  category: Category;
  region: Region;
  status: LeadStatus;
  firm: FirmRef | null;
  latest_decline: DeclineOut | null;
  created_at: string;
  updated_at: string;
}

export interface DeclineOut {
  id: number;
  firm: FirmRef;
  user: UserRef;
  reason: string;
  created_at: string;
}

export interface AdminLeadDetail extends AdminLead {
  description: string;
  plaintiff: UserRef;
  case_id: number | null;
  declines: DeclineOut[];
}

export interface AdminCase {
  id: number;
  lead_id: number;
  plaintiff_name: string;
  category: Category;
  region: Region;
  status: CaseStatus;
  firm: FirmRef;
  created_at: string;
  updated_at: string;
}

export interface AdminCaseDetail extends AdminCase {
  plaintiff_email: string;
  description: string;
}

export interface AdminNote extends NoteOut {
  author_firm: FirmRef;
  from_previous_firm: boolean;
}
