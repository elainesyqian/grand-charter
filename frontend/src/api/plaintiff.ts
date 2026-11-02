import { apiGet, apiSend, apiUpload } from './client';
import type {
  CaseUpdateOut,
  DocumentOut,
  LeadCreate,
  Page,
  PlaintiffLeadDetail,
  PlaintiffLeadSummary,
} from './types';

export const plaintiffApi = {
  submitLead: (body: LeadCreate) => apiSend<PlaintiffLeadDetail>('POST', '/plaintiff/leads', body),
  listLeads: (page: number) => apiGet<Page<PlaintiffLeadSummary>>('/plaintiff/leads', { page }),
  getLead: (id: number) => apiGet<PlaintiffLeadDetail>(`/plaintiff/leads/${id}`),
  listUpdates: (id: number, page = 1) =>
    apiGet<Page<CaseUpdateOut>>(`/plaintiff/leads/${id}/updates`, { page, page_size: 50 }),
  listDocuments: (id: number, page = 1) =>
    apiGet<Page<DocumentOut>>(`/plaintiff/leads/${id}/documents`, { page, page_size: 50 }),
  uploadDocument: (id: number, file: File) =>
    apiUpload<DocumentOut>(`/plaintiff/leads/${id}/documents`, file),
};
