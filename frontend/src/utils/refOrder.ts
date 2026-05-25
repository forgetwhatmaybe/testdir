/** 通用工具：基于 edges 找出连入某节点某 handle 的源节点 ID 列表，并按 ref_order_<handle> 排序。*/
import type { Edge, Node } from 'reactflow';

export function refSources(nodeId: string, handle: string, edges: Edge[]): string[] {
  return edges
    .filter((e) => e.target === nodeId && e.targetHandle === handle)
    .map((e) => e.source);
}

/** 优先读取 ref_order_<handle>，其次 ref_order（向后兼容单端口节点）。*/
export function orderedRefs(node: Node, handle: string, edges: Edge[]): string[] {
  const sources = refSources(node.id, handle, edges);
  const data = (node.data as any) || {};
  const order: string[] = data[`ref_order_${handle}`] || data.ref_order || [];
  if (!order.length) return sources;
  const used = new Set<string>();
  const out: string[] = [];
  for (const sid of order) {
    if (sources.includes(sid)) {
      out.push(sid); used.add(sid);
    }
  }
  for (const sid of sources) {
    if (!used.has(sid)) out.push(sid);
  }
  return out;
}

export function refOrderField(handle: string): string {
  // gemini/text_vision 单端口节点用 ref_order；seedance2 等多端口用 ref_order_<handle>
  if (handle === 'in_refs' || handle === 'in_image') return 'ref_order';
  return `ref_order_${handle}`;
}

