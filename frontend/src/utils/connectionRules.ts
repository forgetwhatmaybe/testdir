/** 连线规则：输入口默认单连，多连点支持多输入。*/
import type { Connection, Edge, Node } from 'reactflow';

export type HandleKind = 'image' | 'video' | 'text' | 'mask' | 'audio' | 'refs_image' | 'refs_video' | 'refs_audio';

export const NODE_OUTPUT_KINDS: Record<string, Record<string, HandleKind>> = {
  image:        { out: 'image', mask: 'mask' },
  video:        { out: 'video' },
  audio:        { out: 'audio' },
  kling:        { out: 'video' },
  jimeng:       { out: 'video' },
  veo3:         { out: 'video' },
  seedance2:    { out: 'video' },
  gemini:       { out: 'image' },
  image_edit:   { out: 'image' },
  storyboard:   { out: 'image' },
  text_vision:  { out: 'text' },
  text_display: { out: 'text' },
  output:       { out: 'video' },  // 链式：上游决定
};

export const NODE_INPUT_KINDS: Record<string, Record<string, HandleKind>> = {
  kling:        { in_image: 'image', in_first: 'image', in_last: 'image' },
  jimeng:       { in_image: 'image', in_first: 'image', in_last: 'image' },
  veo3:         { in_image: 'image', in_first: 'image', in_last: 'image' },
  seedance2:    {
    in_images: 'refs_image', in_videos: 'refs_video', in_audios: 'refs_audio',
    in_image: 'image', in_first: 'image', in_last: 'image',
  },
  gemini:       { in_refs: 'refs_image' },
  image_edit:   { in_image: 'image', in_mask: 'mask' },
  storyboard:   { in: 'image' },
  text_vision:  { in_image: 'refs_image' },
  text_display: { in_text: 'text' },
  output:       { in: 'image' },  // 接受任意（在校验里特例）
};

const REFS_MAX_DEFAULT = 14;
const REFS_MAX: Record<string, Record<string, number>> = {
  gemini: { in_refs: 14 },
  text_vision: { in_image: 14 },
  seedance2: { in_images: 9, in_videos: 3, in_audios: 3 },
};

export function maxFor(targetType: string, targetHandle: string): number {
  return REFS_MAX[targetType]?.[targetHandle] ?? REFS_MAX_DEFAULT;
}

export function isValidConnection(conn: Connection, nodes: Node[], edges: Edge[]): boolean {
  if (!conn.source || !conn.target || !conn.sourceHandle || !conn.targetHandle) return false;
  if (conn.source === conn.target) return false;

  const src = nodes.find((n) => n.id === conn.source);
  const dst = nodes.find((n) => n.id === conn.target);
  if (!src || !dst) return false;

  const srcKind = NODE_OUTPUT_KINDS[src.type as string]?.[conn.sourceHandle];
  const dstKind = NODE_INPUT_KINDS[dst.type as string]?.[conn.targetHandle];
  if (!srcKind || !dstKind) return false;

  // 1. 占用计数
  const isMulti = dstKind.startsWith('refs_');
  const occupied = edges.filter((e) => e.target === conn.target && e.targetHandle === conn.targetHandle);
  if (isMulti) {
    if (occupied.length >= maxFor(dst.type as string, conn.targetHandle)) return false;
  } else {
    if (occupied.length >= 1) return false;
  }

  // 2. 类型校验
  // OutputNode 接受任意类型 → out 也可以传给任意下游
  if (dst.type === 'output' && conn.targetHandle === 'in') return true;
  if (src.type === 'output' && conn.sourceHandle === 'out') return true;

  if (dstKind === 'refs_image') return srcKind === 'image';
  if (dstKind === 'refs_video') return srcKind === 'video';
  if (dstKind === 'refs_audio') return srcKind === 'audio';
  if (dstKind === 'image') return srcKind === 'image';
  if (dstKind === 'video') return srcKind === 'video';
  if (dstKind === 'audio') return srcKind === 'audio';
  if (dstKind === 'text') return srcKind === 'text';
  if (dstKind === 'mask') return srcKind === 'mask' || srcKind === 'image';
  return false;
}
