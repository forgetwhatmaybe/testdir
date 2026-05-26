import { GEMINI_MODELS } from './modelOptions';

type WorkflowNodeLike = {
  type?: unknown;
  data?: Record<string, unknown> | null;
};

type WorkflowLike<TNode extends WorkflowNodeLike = WorkflowNodeLike> = {
  nodes?: TNode[];
};

export function normalizeNodeDataDefaults<TNode extends WorkflowNodeLike>(node: TNode): TNode {
  const data = { ...((node.data as Record<string, unknown> | null) ?? {}) };
  let changed = false;

  if (node.type === 'image' && data.mask_path && !data.has_mask_output) {
    data.has_mask_output = true;
    changed = true;
  }

  if (node.type === 'gemini') {
    const model = String(data.model ?? '').trim();
    if (!model) {
      data.model = GEMINI_MODELS[0];
      changed = true;
    }
  }

  if (!changed) return node;
  return { ...node, data };
}

export function normalizeWorkflowNodes<TNode extends WorkflowNodeLike>(nodes: TNode[]): TNode[] {
  let changed = false;
  const normalized = nodes.map((node) => {
    const nextNode = normalizeNodeDataDefaults(node);
    if (nextNode !== node) changed = true;
    return nextNode;
  });
  return changed ? normalized : nodes;
}

export function normalizeWorkflowPayload<TWorkflow extends WorkflowLike>(workflow: TWorkflow): TWorkflow {
  if (!Array.isArray(workflow.nodes)) return workflow;
  const nodes = normalizeWorkflowNodes(workflow.nodes);
  if (nodes === workflow.nodes) return workflow;
  return { ...workflow, nodes };
}