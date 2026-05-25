/** 从命中节点出发 BFS 上下游全部相连节点。*/
import type { Edge, Node } from 'reactflow';

export function collectConnected(seedId: string, nodes: Node[], edges: Edge[]): Set<string> {
  const seen = new Set<string>([seedId]);
  const queue: string[] = [seedId];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const e of edges) {
      if (e.source === cur && !seen.has(e.target)) { seen.add(e.target); queue.push(e.target); }
      if (e.target === cur && !seen.has(e.source)) { seen.add(e.source); queue.push(e.source); }
    }
  }
  return seen;
}
