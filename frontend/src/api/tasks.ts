import { getJson, postJson } from './client';
import { normalizeWorkflowPayload } from '../utils/workflowDefaults';

export interface TaskInfo {
  id: string;
  project: string;
  output_node_id: string;
  name: string;
  kind: string;
  status: 'queued' | 'running' | 'done' | 'failed' | 'cancelled';
  progress: number;
  message: string;
  result_path?: string | null;
  thumbnail_path?: string | null;
}

export interface RunTasksResponse {
  task_ids: string[];
}

export interface WorkflowPayload {
  version: number;
  viewport?: { x: number; y: number; zoom: number };
  nodes: Record<string, unknown>[];
  edges: Record<string, unknown>[];
}

export function runTasks(project: string, workflow: WorkflowPayload, output_node_ids: string[]) {
  return postJson<RunTasksResponse>('/tasks/run', {
    project,
    workflow: normalizeWorkflowPayload(workflow),
    output_node_ids,
  });
}

export function listTasks() {
  return getJson<TaskInfo[]>('/tasks');
}

export function cancelTask(id: string) {
  return postJson<void>(`/tasks/${id}/cancel`);
}

export function cancelAll() {
  return postJson<void>('/tasks/cancel-all');
}

export function clearFinished() {
  return postJson<TaskInfo[]>('/tasks/clear-finished');
}
