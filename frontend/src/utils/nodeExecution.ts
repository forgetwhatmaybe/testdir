import type { Edge, Node, Viewport } from 'reactflow';
import { runTasks, type WorkflowPayload } from '../api/tasks';

export type RunTargetMode = 'selected-or-all' | 'clicked-or-selected' | 'all';

type FlowSnapshotLike = {
  nodes: Node[];
  edges: Edge[];
  viewport: Viewport;
};

const RUNNABLE_NODE_TYPES = new Set(['output', 'text_display']);

export function isRunnableNode(node: Pick<Node, 'type'>): boolean {
  return RUNNABLE_NODE_TYPES.has(node.type as string);
}

export function clampOutputBatchCount(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 1;
  return Math.max(1, Math.min(10, Math.trunc(parsed)));
}

export function collectRunnableTargets(
  nodes: Node[],
  options: { clickedNodeId?: string; mode?: RunTargetMode } = {},
): Node[] {
  const mode = options.mode || 'selected-or-all';
  const selectedTargets = nodes.filter((node) => node.selected && isRunnableNode(node));

  if (mode === 'all') {
    return nodes.filter(isRunnableNode);
  }

  if (mode === 'clicked-or-selected' && options.clickedNodeId) {
    const clickedNode = nodes.find((node) => node.id === options.clickedNodeId && isRunnableNode(node));
    if (!clickedNode) return [];
    if (clickedNode.selected && selectedTargets.length > 1) {
      return selectedTargets;
    }
    return [clickedNode];
  }

  return selectedTargets.length ? selectedTargets : nodes.filter(isRunnableNode);
}

function buildWorkflowPayload(snapshot: FlowSnapshotLike): WorkflowPayload {
  return {
    version: 2,
    viewport: snapshot.viewport,
    nodes: snapshot.nodes as unknown as Record<string, unknown>[],
    edges: snapshot.edges as unknown as Record<string, unknown>[],
  };
}

function buildOutputCounts(targets: Node[]): Record<string, number> {
  const counts: Record<string, number> = {};
  targets.forEach((node) => {
    if (node.type === 'output') {
      counts[node.id] = clampOutputBatchCount((node.data as Record<string, unknown> | undefined)?.batch_count);
      return;
    }
    counts[node.id] = 1;
  });
  return counts;
}

export async function runWorkflowTargets(
  project: string,
  snapshot: FlowSnapshotLike,
  options: { clickedNodeId?: string; mode?: RunTargetMode } = {},
): Promise<{ targetCount: number; taskCount: number }> {
  const targets = collectRunnableTargets(snapshot.nodes, options);
  if (!targets.length) {
    return { targetCount: 0, taskCount: 0 };
  }

  const response = await runTasks(
    project,
    buildWorkflowPayload(snapshot),
    targets.map((node) => node.id),
    { outputCounts: buildOutputCounts(targets) },
  );

  return {
    targetCount: targets.length,
    taskCount: response.task_ids.length,
  };
}