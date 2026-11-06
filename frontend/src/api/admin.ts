import { type Query, apiGet, apiSend } from './client';
import type {
  AdminCase,
  AdminCaseDetail,
  AdminLead,
  AdminLeadDetail,
  AdminNote,
  AuditEventOut,
  CaseUpdateOut,
  DocumentOut,
  FirmRef,
  Page,
} from './types';

export interface AssignBody {
  firm_id: number;
  reason?: string | null;
}

export const adminApi = {
  searchLeads: (query: Query) => apiGet<Page<AdminLead>>('/admin/leads', query),
  getLead: (id: number) => apiGet<AdminLeadDetail>(`/admin/leads/${id}`),
  listLeadDocuments: (id: number, page = 1) =>
    apiGet<Page<DocumentOut>>(`/admin/leads/${id}/documents`, { page, page_size: 50 }),
  leadHistory: (id: number, page = 1) =>
    apiGet<Page<AuditEventOut>>(`/admin/leads/${id}/history`, { page, page_size: 50 }),
  assignLead: (id: number, body: AssignBody) =>
    apiSend<AdminLeadDetail>('POST', `/admin/leads/${id}/assign`, body),

  searchCases: (query: Query) => apiGet<Page<AdminCase>>('/admin/cases', query),
  getCase: (id: number) => apiGet<AdminCaseDetail>(`/admin/cases/${id}`),
  listUpdates: (id: number, page = 1) =>
    apiGet<Page<CaseUpdateOut>>(`/admin/cases/${id}/updates`, { page, page_size: 50 }),
  listNotes: (id: number, firmId: number | null, page = 1) =>
    apiGet<Page<AdminNote>>(`/admin/cases/${id}/notes`, { page, page_size: 50, firm_id: firmId }),
  listCaseDocuments: (id: number, page = 1) =>
    apiGet<Page<DocumentOut>>(`/admin/cases/${id}/documents`, { page, page_size: 50 }),
  caseHistory: (id: number, page = 1) =>
    apiGet<Page<AuditEventOut>>(`/admin/cases/${id}/history`, { page, page_size: 50 }),
  reassignCase: (id: number, body: AssignBody) =>
    apiSend<AdminCaseDetail>('POST', `/admin/cases/${id}/reassign`, body),

  audit: (query: Query) => apiGet<Page<AuditEventOut>>('/admin/audit', query),
  firms: () => apiGet<FirmRef[]>('/admin/firms'),
};
