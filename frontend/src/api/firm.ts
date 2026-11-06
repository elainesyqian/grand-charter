import { type Query, apiGet, apiSend, apiUpload } from './client';
import type {
  CaseStatus,
  CaseUpdateOut,
  DocumentOut,
  FirmCaseDetail,
  FirmCaseSummary,
  FirmLeadDetail,
  InboxLead,
  NoteOut,
  Page,
} from './types';

export const firmApi = {
  listInbox: (query: Query) => apiGet<Page<InboxLead>>('/firm/leads', query),
  getLead: (id: number) => apiGet<FirmLeadDetail>(`/firm/leads/${id}`),
  listLeadDocuments: (id: number, page = 1) =>
    apiGet<Page<DocumentOut>>(`/firm/leads/${id}/documents`, { page, page_size: 50 }),
  acceptLead: (id: number) => apiSend<FirmCaseDetail>('POST', `/firm/leads/${id}/accept`),
  declineLead: (id: number, reason: string) =>
    apiSend<void>('POST', `/firm/leads/${id}/decline`, { reason }),

  listCases: (query: Query) => apiGet<Page<FirmCaseSummary>>('/firm/cases', query),
  getCase: (id: number) => apiGet<FirmCaseDetail>(`/firm/cases/${id}`),
  listUpdates: (id: number, page = 1) =>
    apiGet<Page<CaseUpdateOut>>(`/firm/cases/${id}/updates`, { page, page_size: 50 }),
  addUpdate: (id: number, body: { to_status?: CaseStatus | null; message?: string | null }) =>
    apiSend<CaseUpdateOut>('POST', `/firm/cases/${id}/updates`, body),
  listNotes: (id: number, page = 1) =>
    apiGet<Page<NoteOut>>(`/firm/cases/${id}/notes`, { page, page_size: 50 }),
  addNote: (id: number, body: string) =>
    apiSend<NoteOut>('POST', `/firm/cases/${id}/notes`, { body }),
  listDocuments: (id: number, page = 1) =>
    apiGet<Page<DocumentOut>>(`/firm/cases/${id}/documents`, { page, page_size: 50 }),
  uploadDocument: (id: number, file: File) =>
    apiUpload<DocumentOut>(`/firm/cases/${id}/documents`, file),
};
