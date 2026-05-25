import axios from 'axios';

export const api = axios.create({
  baseURL: '/api',
  timeout: 60000,
});

api.interceptors.response.use(
  (resp) => resp,
  (err) => {
    const msg = err?.response?.data?.detail || err?.response?.data?.error || err.message;
    return Promise.reject(new Error(msg));
  },
);

export type ApiOk<T> = { ok: true; data: T };

export async function getJson<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  const r = await api.get<ApiOk<T>>(url, { params });
  return r.data.data;
}

export async function postJson<T>(url: string, body?: unknown): Promise<T> {
  const r = await api.post<ApiOk<T>>(url, body);
  return r.data.data;
}

export async function putJson<T>(url: string, body?: unknown): Promise<T> {
  const r = await api.put<ApiOk<T>>(url, body);
  return r.data.data;
}

export async function delJson<T>(url: string): Promise<T> {
  const r = await api.delete<ApiOk<T>>(url);
  return r.data.data;
}
