import { getJson, postJson, delJson } from './client';

export interface HistoryEntry {
  ts: number;
  output_node_id: string;
  name: string;
  kind: string;
  status: 'done' | 'failed' | 'cancelled';
  result_path?: string | null;
  thumbnail_path?: string | null;
  params?: Record<string, unknown> | null;
  error?: string;
}

export function listHistory(project: string) {
  return getJson<HistoryEntry[]>(`/history/${encodeURIComponent(project)}`);
}

export function addHistory(project: string, entry: HistoryEntry) {
  return postJson<HistoryEntry[]>('/history/', { project, entry });
}

export function clearHistory(project: string) {
  return delJson(`/history/${encodeURIComponent(project)}`);
}
