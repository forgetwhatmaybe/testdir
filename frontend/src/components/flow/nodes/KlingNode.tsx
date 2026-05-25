import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { Input, Select, Slider } from 'antd';
import NodeShell from './shared/NodeShell';
import { useFlowStore } from '../../../store/flowStore';
import {
  KLING_MODELS, klingDurationOptions, klingSupportsFirstLast, normalizeGenerationMode,
} from '../../../utils/modelOptions';

type Data = {
  prompt?: string;
  model?: string;
  mode?: 'image2video' | 'first_last';
  generation_mode?: 'image_to_video' | 'first_last_frame';
  duration?: number;
  resolution?: '720p' | '1080p';
  cfg_scale?: number;
};

const KlingNode = memo(function KlingNode({ id, data, selected }: NodeProps<Data>) {
  const updateNodeData = useFlowStore((s) => s.updateNodeData);
  const update = (patch: Partial<Data>) => updateNodeData(id, patch as Record<string, unknown>);

  const model = data.model || 'kling-v3';
  const resolution = data.resolution || '1080p';
  const mode = normalizeGenerationMode(data.mode, data.generation_mode, 'image2video') as 'image2video' | 'first_last';
  const allowFL = klingSupportsFirstLast(model, resolution);
  const isFirstLast = mode === 'first_last';
  const durations = klingDurationOptions(model);
  const duration = durations.includes(data.duration as number) ? data.duration! : durations[0];
  const cfgScale = data.cfg_scale ?? 0.5;

  return (
    <NodeShell type="kling" selected={selected} title="可灵生视频" color="#7e57c2" variant="kling" nodeId={id}>
      <div className="node-row">
        <span className="node-label" style={{ width: 50 }}>模式</span>
        <Select size="small" value={mode} style={{ flex: 1 }}
          options={[
            { value: 'image2video', label: '图生视频' },
            { value: 'first_last', label: '首尾帧', disabled: !allowFL },
          ]}
          onChange={(v) => update({ mode: v })} />
      </div>
      <div className="node-row">
        <span className="node-label" style={{ width: 50 }}>模型</span>
        <Select size="small" value={model} style={{ flex: 1 }}
          options={KLING_MODELS.map((m) => ({ value: m, label: m }))}
          onChange={(v) => {
            const newDurations = klingDurationOptions(v);
            const newDur = newDurations.includes(duration) ? duration : newDurations[0];
            update({ model: v, duration: newDur });
          }} />
      </div>
      <div className="node-row">
        <span className="node-label" style={{ width: 50 }}>时长</span>
        <Select size="small" value={duration} style={{ flex: 1 }}
          options={durations.map((d) => ({ value: d, label: `${d}s` }))}
          onChange={(v) => update({ duration: v })} />
      </div>
      <div className="node-row">
        <span className="node-label" style={{ width: 50 }}>分辨率</span>
        <Select size="small" value={resolution} style={{ flex: 1 }}
          options={[{ value: '720p', label: '720p (std)' }, { value: '1080p', label: '1080p (pro)' }]}
          onChange={(v) => update({ resolution: v as any })} />
      </div>
      <div className="node-row">
        <span className="node-label" style={{ width: 50 }}>CFG</span>
        <Slider min={0} max={1} step={0.05} value={cfgScale} style={{ flex: 1 }}
          onChange={(v) => update({ cfg_scale: v as number })} />
        <span className="node-cfg-display">{cfgScale.toFixed(2)}</span>
      </div>
      <Input.TextArea size="small" rows={2} placeholder="提示词"
        value={data.prompt || ''} onChange={(e) => update({ prompt: e.target.value })} />

      {isFirstLast ? (
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

export default KlingNode;
