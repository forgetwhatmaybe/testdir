import { api, getJson, postJson, putJson, delJson } from './client';

export interface ProjectInfo { name: string; path: string; disk: string; }

export interface WorkflowData {
  version: number;
  viewport: { x: number; y: number; zoom: number };
  nodes: Record<string, unknown>[];
  edges: Record<string, unknown>[];
}

export async function listProjects(): Promise<{ data: ProjectInfo[]; disks: string[] }> {
  const r = await api.get('/projects');
  return { data: r.data.data, disks: r.data.disks };
}

export function createProject(disk: string, name: string) {
  return postJson<ProjectInfo>('/projects', { disk, name });
}

export function deleteProject(name: string) {
  return delJson(`/projects/${encodeURIComponent(name)}`);
}

export function loadWorkflow(name: string) {
  return getJson<WorkflowData>(`/projects/${encodeURIComponent(name)}/workflow`);
}

export function saveWorkflow(name: string, workflow: WorkflowData) {
  return putJson<void>(`/projects/${encodeURIComponent(name)}/workflow`, workflow);
}
