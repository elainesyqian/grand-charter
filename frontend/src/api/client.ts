// Thin fetch wrapper. Same-origin `/api` (proxied by Vite in dev), session cookie auth.

export class ApiError extends Error {
  readonly status: number;
  readonly detail: unknown;

  constructor(status: number, detail: unknown) {
    super(ApiError.describe(status, detail));
    this.status = status;
    this.detail = detail;
  }

  // FastAPI returns `detail` as a string, or as a list of field errors for 422s.
  private static describe(status: number, detail: unknown): string {
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail) && detail.length > 0) {
      const first = detail[0] as { msg?: string; loc?: unknown[] };
      const field = first.loc?.[first.loc.length - 1];
      return field ? `${String(field)}: ${first.msg}` : (first.msg ?? 'Invalid input');
    }
    return `Request failed (${status})`;
  }
}

export type Query = Record<string, string | number | string[] | null | undefined>;

function buildUrl(path: string, query?: Query): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === null || value === undefined || value === '') continue;
    if (Array.isArray(value)) value.forEach((v) => params.append(key, v));
    else params.append(key, String(value));
  }
  const qs = params.toString();
  return `/api${path}${qs ? `?${qs}` : ''}`;
}

async function parse<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, body?.detail ?? null);
  return body as T;
}

export async function apiGet<T>(path: string, query?: Query): Promise<T> {
  return parse<T>(await fetch(buildUrl(path, query), { credentials: 'same-origin' }));
}

export async function apiSend<T>(
  method: 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(buildUrl(path), {
    method,
    credentials: 'same-origin',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return parse<T>(res);
}

export async function apiUpload<T>(path: string, file: File): Promise<T> {
  const form = new FormData();
  form.append('file', file);
  return parse<T>(
    await fetch(buildUrl(path), { method: 'POST', credentials: 'same-origin', body: form }),
  );
}

export const documentUrl = (id: number) => `/api/documents/${id}`;
