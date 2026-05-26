/** 参考图（视频/音频）缩略图条：横向多列，可拖拽重排。*/
import { useRef, useState, type CSSProperties } from 'react';
import { useFlowStore } from '../../../../store/flowStore';
import { useProjectStore } from '../../../../store/projectStore';
import { rawUrl, thumbnailUrl } from '../../../../api/files';
import { refOrderField } from '../../../../utils/refOrder';

type Props = {
  nodeId: string;
  /** 当前已连入的源节点 ID 列表（按 ref_order 顺序） */
  refNodeIds: string[];
  /** 媒体类型决定缩略图 URL 来源 */
  mediaType?: 'image' | 'video' | 'audio';
  /** 写回的 ref_order 字段对应的 handle 名（决定 ref_order 还是 ref_order_<handle>） */
  handle?: string;
  size?: number;
  cols?: number;
};

export default function ThumbStrip({ nodeId, refNodeIds, mediaType = 'image', handle = 'in_refs', size = 40, cols = 4 }: Props) {
  const project = useProjectStore((s) => s.current);
  const nodes = useFlowStore((s) => s.nodes);
  const updateNodeData = useFlowStore((s) => s.updateNodeData);
  const pushHistory = useFlowStore((s) => s.pushHistory);
  const [drag, setDrag] = useState<{ from: number | null; over: number | null }>({ from: null, over: null });
  const stripRef = useRef<HTMLDivElement>(null);

  if (!refNodeIds.length || !project) return null;

  const setOrder = (next: string[]) => {
    const field = refOrderField(handle);
    updateNodeData(nodeId, { [field]: next });
    pushHistory();
  };

  const sourcePath = (sid: string): string | null => {
    const src = nodes.find((n) => n.id === sid);
    if (!src) return null;
    const d = (src.data as any) || {};
    return d.image_path || d.video_path || d.audio_path || null;
  };

  const onDragStart = (e: React.DragEvent, idx: number) => {
    e.stopPropagation();
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/x-thumb-idx', String(idx));
    setDrag({ from: idx, over: idx });
  };
  const onDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDrag((d) => ({ ...d, over: idx }));
  };
  const onDrop = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    e.stopPropagation();
    const from = Number(e.dataTransfer.getData('application/x-thumb-idx'));
    if (Number.isNaN(from) || from === idx) { setDrag({ from: null, over: null }); return; }
    const arr = [...refNodeIds];
    const [moved] = arr.splice(from, 1);
    arr.splice(idx, 0, moved);
    setOrder(arr);
    setDrag({ from: null, over: null });
  };

  const wrap: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: `repeat(${cols}, ${size}px)`,
    gap: 4,
    margin: '4px 0',
  };

  return (
    <div ref={stripRef} style={wrap}>
      {refNodeIds.map((sid, idx) => {
        const path = sourcePath(sid);
        const url = path
          ? (mediaType === 'video' ? thumbnailUrl(project, path) : rawUrl(project, path))
          : null;
        const cls: CSSProperties = {
          width: size, height: size,
          borderRadius: 4, border: '2px solid transparent',
          background: '#0d0d0d', backgroundSize: 'cover', backgroundPosition: 'center',
          cursor: 'grab',
          ...(drag.from === idx ? { borderColor: '#ff9800' } : {}),
          ...(drag.over === idx && drag.from !== idx ? { borderColor: '#4caf50' } : {}),
        };
        return (
          <div
            key={sid}
            style={cls}
            draggable
            title={path || sid}
            onDragStart={(e) => onDragStart(e, idx)}
            onDragOver={(e) => onDragOver(e, idx)}
            onDrop={(e) => onDrop(e, idx)}
          >
            {url && (mediaType !== 'audio' ? (
              <img src={url} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 2 }} alt="" />
            ) : (
              <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', color: '#80cbc4', fontSize: 16 }}>♪</div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
