/** 给 output_N / text_output_N 命名分配唯一序号。*/
import type { Node } from 'reactflow';

function nextNumberedName(prefix: string, type: string, nodes: Node[]): string {
  const used = new Set<number>();
  const rx = new RegExp(`^${prefix}_(\\d+)$`);
  for (const n of nodes) {
    if (n.type !== type) continue;
    const m = rx.exec((n.data as any)?.name || '');
    if (m) used.add(Number(m[1]));
  }
  let i = 1;
  while (used.has(i)) i += 1;
  return `${prefix}_${i}`;
}

export function nextOutputName(nodes: Node[]): string {
  return nextNumberedName('output', 'output', nodes);
}

export function nextTextOutputName(nodes: Node[]): string {
  return nextNumberedName('text_output', 'text_display', nodes);
}

export function uniqueId(prefix = 'n'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}
