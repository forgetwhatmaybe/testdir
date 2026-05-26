import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { Input, Select, Slider, Switch } from 'antd';
import NodeShell from './shared/NodeShell';
import ThumbStrip from './shared/ThumbStrip';
import { useFlowStore } from '../../../store/flowStore';
import {
  SEEDANCE_MODES, SEEDANCE_QUALITIES, SEEDANCE_ASPECTS, estimateTokens, normalizeGenerationMode,
} from '../../../utils/modelOptions';
import { orderedRefs } from '../../../utils/refOrder';

type Data = {
  prompt?: string;
  mode?: 'reference' | 'image2video' | 'first_last';
  generation_mode?: 'multimodal' | 'image_to_video' | 'first_last_frame';
  duration?: number;
  quality?: string;
  aspect_ratio?: string;
  generate_audio?: boolean;
  ref_order?: string[];
  ref_order_video?: string[];
  ref_order_audio?: string[];
};

const Seedance2Node = memo(function Seedance2Node({ id, data, selected }: NodeProps<Data>) {
  const edges = useFlowStore((s) => s.edges);
  const updateNodeData = useFlowStore((s) => s.updateNodeData);
  const mode = normalizeGenerationMode(data.mode, data.generation_mode, 'reference') as 'reference' | 'image2video' | 'first_last';
  const update = (patch: Partial<Data>) => updateNodeData(id, patch as Record<string, unknown>, { syncSelectedType: true });

  const tokens = estimateTokens(data.prompt || '');
  const node = { id, data, type: 'seedance2', position: { x: 0, y: 0 } } as any;
  const imgRefs = mode === 'reference' ? orderedRefs(node, 'in_images', edges) : [];
  const vidRefs = mode === 'reference' ? orderedRefs(node, 'in_videos', edges) : [];
  const audRefs = mode === 'reference' ? orderedRefs(node, 'in_audios', edges) : [];

  return (
    <NodeShell type="seedance2" selected={selected} title="Seedance 2.0" color="#9c27b0" variant="seedance" nodeId={id}>
      <div className="node-row">
        <span className="node-label" style={{ width: 50 }}>模式</span>
        <Select size="small" value={mode} style={{ flex: 1 }}
          options={SEEDANCE_MODES} onChange={(v) => update({ mode: v as any })} />
      </div>

      {mode === 'reference' && (
        <>
          {imgRefs.length > 0 && <ThumbStrip nodeId={id} refNodeIds={imgRefs} mediaType="image" handle="in_images" cols={4} size={36} />}
          {vidRefs.length > 0 && <ThumbStrip nodeId={id} refNodeIds={vidRefs} mediaType="video" handle="in_videos" cols={4} size={36} />}
          {audRefs.length > 0 && <ThumbStrip nodeId={id} refNodeIds={audRefs} mediaType="audio" handle="in_audios" cols={4} size={36} />}
        </>
      )}

      <Input.TextArea size="small" rows={3} placeholder="提示词（支持 @tag 引用）"
        value={data.prompt || ''} onChange={(e) => update({ prompt: e.target.value })} />
      <div className="node-token">tokens: {tokens}</div>

      <div className="node-row">
        <span className="node-label" style={{ width: 50 }}>时长</span>
        <Slider min={4} max={15} step={1} value={data.duration ?? 5} style={{ flex: 1 }}
          onChange={(v) => update({ duration: v as number })} />
        <span className="node-cfg-display">{data.duration ?? 5}s</span>
      </div>
      <div className="node-row">
        <span className="node-label" style={{ width: 50 }}>分辨率</span>
        <Select size="small" value={data.quality || '720p'} style={{ flex: 1 }}
          options={SEEDANCE_QUALITIES.map((q) => ({ value: q, label: q }))}
          onChange={(v) => update({ quality: v })} />
      </div>
      <div className="node-row">
        <span className="node-label" style={{ width: 50 }}>比例</span>
        <Select size="small" value={data.aspect_ratio || '16:9'} style={{ flex: 1 }}
          options={SEEDANCE_ASPECTS.map((a) => ({ value: a, label: a }))}
          onChange={(v) => update({ aspect_ratio: v })} />
      </div>
      <div className="node-row">
        <span className="node-label" style={{ width: 50 }}>同步音频</span>
        <Switch size="small" checked={data.generate_audio !== false}
          onChange={(v) => update({ generate_audio: v })} />
      </div>

      {/* 输入端口 */}
      {mode === 'reference' ? (
        <>
          <Handle type="target" position={Position.Left} id="in_images" className="handle-refs" style={{ top: 30 }} />
          <Handle type="target" position={Position.Left} id="in_videos" className="handle-video" style={{ top: 60 }} />
          <Handle type="target" position={Position.Left} id="in_audios" className="handle-audio" style={{ top: 90 }} />
        </>
      ) : mode === 'first_last' ? (
        <>
          <Handle type="target" position={Position.Left} id="in_first" className="handle-image" style={{ top: 36 }} />
          <Handle type="target" position={Position.Left} id="in_last"  className="handle-image" style={{ top: 64 }} />
        </>
      ) : (
        <Handle type="target" position={Position.Left} id="in_image" className="handle-image" />
      )}
      <Handle type="source" position={Position.Right} id="out" className="handle-video" />
    </NodeShell>
  );
});

export default Seedance2Node;
