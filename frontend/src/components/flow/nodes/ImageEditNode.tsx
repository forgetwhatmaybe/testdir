import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { Input, Select, Slider, InputNumber, Button, Space, Tooltip } from 'antd';
import { ClearOutlined, BgColorsOutlined, UndoOutlined } from '@ant-design/icons';
import NodeShell from './shared/NodeShell';
import { useFlowStore } from '../../../store/flowStore';
import { IMAGE_EDIT_MODES } from '../../../utils/modelOptions';
import { api } from '../../../api/client';

type Data = {
  edit_mode?: 'kling_expand' | 'jimeng_super' | 'jimeng_inpaint';
  prompt?: string;
  up?: number; down?: number; left?: number; right?: number;
  resolution?: '4k' | '8k';
  scale?: number;
  seed?: number;
  mask_strokes?: Stroke[];
  mask_brush_size?: number;
  mask_opacity?: number;
  mask_path?: string;
};

type Stroke = { x: number; y: number; type: 'paint' | 'erase' };

function expansionArea(d: Data): number {
  const u = d.up ?? 0, dn = d.down ?? 0, l = d.left ?? 0, r = d.right ?? 0;
  return (1 + u + dn) * (1 + l + r);
}

const ImageEditNode = memo(function ImageEditNode({ id, data, selected }: NodeProps<Data>) {
  const updateNodeData = useFlowStore((s) => s.updateNodeData);
  const update = (patch: Partial<Data>) => updateNodeData(id, patch as Record<string, unknown>);

  const mode = data.edit_mode || 'kling_expand';
  const area = expansionArea(data);

  // ---- 蒙版绘制状态 ----
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [showMask, setShowMask] = useState(false);
  const strokes = data.mask_strokes || [];
  const brushSize = data.mask_brush_size || 20;
  const maskOpacity = data.mask_opacity ?? 0.6;

  const redrawMask = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const s of strokes) {
      ctx.beginPath();
      ctx.arc(s.x, s.y, brushSize / 2, 0, Math.PI * 2);
      if (s.type === 'erase') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = 'rgba(0,0,0,1)';
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = `rgba(220, 38, 38, ${maskOpacity})`;
      }
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }, [strokes, brushSize, maskOpacity]);

  useEffect(() => { redrawMask(); }, [redrawMask]);

  const getCanvasPos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const scaleX = 400 / rect.width;
    const scaleY = 300 / rect.height;
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!showMask) return;
    const pos = getCanvasPos(e);
    const type: 'paint' | 'erase' = e.button === 2 ? 'erase' : 'paint';
    const newStrokes = [...strokes, { ...pos, type }];
    update({ mask_strokes: newStrokes });
    setIsDrawing(true);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !showMask) return;
    const pos = getCanvasPos(e);
    const type: 'paint' | 'erase' = e.buttons === 2 ? 'erase' : 'paint';
    const newStrokes = [...strokes, { ...pos, type }];
    update({ mask_strokes: newStrokes });
  };

  const handleMouseUp = () => setIsDrawing(false);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
  };

  const clearMask = () => update({ mask_strokes: [] });

  const undoLastStroke = () => {
    if (strokes.length === 0) return;
    update({ mask_strokes: strokes.slice(0, -1) });
  };

  const saveMaskToServer = async () => {
    try {
      const r = await api.post('/mask/save', {
        project: 'default',
        image_name: `node_${id}`,
        strokes,
        brush_size: brushSize,
        brush_color: [220, 38, 38, Math.round(maskOpacity * 255)],
        original_size: [400, 300],
      });
      update({ mask_path: r.data.data });
    } catch { /* ignore */ }
  };

  return (
    <NodeShell type="image_edit" selected={selected} title="图片修改" color="#ec407a" variant="edit" nodeId={id}>
      <div className="node-row">
        <span className="node-label" style={{ width: 50 }}>模式</span>
        <Select size="small" value={mode} style={{ flex: 1 }}
          options={IMAGE_EDIT_MODES} onChange={(v) => update({ edit_mode: v })} />
      </div>

      {mode === 'kling_expand' && (
        <>
          {(['up', 'down', 'left', 'right'] as const).map((k) => (
            <div className="node-row" key={k}>
              <span className="node-label" style={{ width: 28 }}>{
                k === 'up' ? '上' : k === 'down' ? '下' : k === 'left' ? '左' : '右'
              }</span>
              <Slider min={0} max={2} step={0.05} style={{ flex: 1 }}
                value={(data as any)[k] ?? 0}
                onChange={(v) => update({ [k]: v as number } as any)} />
              <span className="node-cfg-display">{((data as any)[k] ?? 0).toFixed(2)}</span>
            </div>
          ))}
          {area > 3 && (
            <div className="node-warn">面积 {area.toFixed(2)}x &gt; 3x，执行时将自动裁剪</div>
          )}
          <Input.TextArea size="small" rows={1} placeholder="提示词（可空）"
            value={data.prompt || ''} onChange={(e) => update({ prompt: e.target.value })} />
        </>
      )}

      {mode === 'jimeng_super' && (
        <>
          <div className="node-row">
            <span className="node-label" style={{ width: 50 }}>分辨率</span>
            <Select size="small" value={data.resolution || '4k'} style={{ flex: 1 }}
              options={[{ value: '4k', label: '4K' }, { value: '8k', label: '8K' }]} onChange={(v) => update({ resolution: v })} />
          </div>
          <div className="node-row">
            <span className="node-label" style={{ width: 50 }}>锐化</span>
            <Slider min={0} max={100} step={1} style={{ flex: 1 }}
              value={data.scale ?? 50} onChange={(v) => update({ scale: v as number })} />
            <span className="node-cfg-display">{data.scale ?? 50}</span>
          </div>
        </>
      )}

      {mode === 'jimeng_inpaint' && (
        <>
          <div className="node-row">
            <span className="node-label" style={{ width: 50 }}>Seed</span>
            <InputNumber size="small" value={data.seed ?? 101} min={-1} max={999999} style={{ flex: 1 }}
              onChange={(v) => update({ seed: v as number })} />
          </div>
          <Input.TextArea size="small" rows={2} maxLength={120} showCount placeholder="提示词（必填，≤120字）"
            value={data.prompt || ''} onChange={(e) => update({ prompt: e.target.value })} />

          {/* ---- 蒙版绘制区域 ---- */}
          <div style={{ marginTop: 8, borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 11, color: '#aaa' }}>蒙版绘制</span>
              <Space size={2}>
                <Tooltip title="画笔大小">
                  <Slider
                    min={4} max={60} step={2}
                    value={brushSize}
                    onChange={(v) => update({ mask_brush_size: v as number })}
                    style={{ width: 60, margin: 0 }}
                    tooltip={{ formatter: (v) => `${v}px` }}
                  />
                </Tooltip>
                <Tooltip title="透明度">
                  <Slider
                    min={0.1} max={1} step={0.05}
                    value={maskOpacity}
                    onChange={(v) => update({ mask_opacity: v as number })}
                    style={{ width: 50, margin: 0 }}
                    tooltip={{ formatter: (v) => `${Math.round(v! * 100)}%` }}
                  />
                </Tooltip>
              </Space>
            </div>
            <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
              <Button
                size="small"
                type={showMask ? 'primary' : 'default'}
                danger={showMask}
                icon={<BgColorsOutlined />}
                onClick={() => setShowMask(!showMask)}
                style={{ fontSize: 11, flex: 1 }}
              >
                {showMask ? '关闭蒙版' : '绘制蒙版'}
              </Button>
              <Tooltip title="撤销一笔">
                <Button size="small" icon={<UndoOutlined />} onClick={undoLastStroke} disabled={strokes.length === 0} />
              </Tooltip>
              <Tooltip title="清除全部">
                <Button size="small" icon={<ClearOutlined />} onClick={clearMask} disabled={strokes.length === 0} danger />
              </Tooltip>
            </div>
            {showMask && (
              <div style={{
                position: 'relative', width: '100%', aspectRatio: '4/3',
                background: '#111', borderRadius: 4, overflow: 'hidden',
                border: '1px solid rgba(220,38,38,0.4)',
                boxShadow: '0 0 12px rgba(220,38,38,0.2)',
              }}>
                <canvas
                  ref={canvasRef}
                  width={400} height={300}
                  style={{ width: '100%', height: '100%', cursor: 'crosshair' }}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  onContextMenu={handleContextMenu}
                />
                <div style={{
                  position: 'absolute', bottom: 4, left: 8,
                  fontSize: 9, color: 'rgba(255,255,255,0.4)',
                  pointerEvents: 'none',
                }}>
                  左键涂抹 | 右键擦除 | {strokes.length} 笔
                </div>
              </div>
            )}
            {strokes.length > 0 && !showMask && (
              <div style={{ fontSize: 10, color: '#ec407a', marginTop: 2 }}>
                已绘制 {strokes.length} 笔 · 画笔 {brushSize}px · 透明度 {Math.round(maskOpacity * 100)}%
              </div>
            )}
          </div>
        </>
      )}

      <Handle type="target" position={Position.Left} id="in_image" className="handle-image" style={{ top: 36 }} />
      {mode === 'jimeng_inpaint' && (
        <Handle type="target" position={Position.Left} id="in_mask" className="handle-mask" style={{ top: 64 }} />
      )}
      <Handle type="source" position={Position.Right} id="out" className="handle-image" />
    </NodeShell>
  );
});

export default ImageEditNode;
