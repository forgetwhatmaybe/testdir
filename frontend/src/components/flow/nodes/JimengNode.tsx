import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { Input, Select, InputNumber } from 'antd';
import NodeShell from './shared/NodeShell';
import { useFlowStore } from '../../../store/flowStore';
import {
  JIMENG_MODELS, JIMENG_DURATIONS, jimengShowsResolution, jimengAllowFirstLast, normalizeGenerationMode,
} from '../../../utils/modelOptions';

type Data = {
  prompt?: string;
  model?: string;
  mode?: 'image2video' | 'first_last';
  generation_mode?: 'image_to_video' | 'first_last_frame';
  duration?: number;
  resolution?: '720P' | '1080P';
  seed?: number;
};

const JimengNode = memo(function JimengNode({ id, data, selected }: NodeProps<Data>) {
  const updateNodeData = useFlowStore((s) => s.updateNodeData);
  const update = (patch: Partial<Data>) => updateNodeData(id, patch as Record<string, unknown>, { syncSelectedType: true });

  const model = data.model || 'jimeng_v30';
  const flAllowed = jimengAllowFirstLast(model);
  const mode = normalizeGenerationMode(data.mode, data.generation_mode, 'image2video') as 'image2video' | 'first_last';
  const isFL = mode === 'first_last';
  const showResolution = jimengShowsResolution(model);

  return (
    <NodeShell type="jimeng" selected={selected} title="即梦生视频" color="#ff7043" variant="jimeng" nodeId={id}>
      <div className="node-row">
        <span className="node-label" style={{ width: 50 }}>模式</span>
        <Select size="small" value={mode} style={{ flex: 1 }}
          options={[
            { value: 'image2video', label: '图生视频' },
            { value: 'first_last', label: '首尾帧', disabled: !flAllowed },
          ]}
          onChange={(v) => update({ mode: v })} />
      </div>
      <div className="node-row">
        <span className="node-label" style={{ width: 50 }}>模型</span>
        <Select size="small" value={model} style={{ flex: 1 }}
          options={JIMENG_MODELS.map((m) => ({ value: m, label: m }))}
          onChange={(v) => update({
            model: v,
            mode: v === 'jimeng_v30_pro' ? 'image2video' : data.mode,
          })} />
      </div>
      <div className="node-row">
        <span className="node-label" style={{ width: 50 }}>时长</span>
        <Select size="small" value={data.duration || 5} style={{ flex: 1 }}
          options={JIMENG_DURATIONS.map((d) => ({ value: d, label: `${d}s` }))}
          onChange={(v) => update({ duration: v })} />
      </div>
      {showResolution && (
        <div className="node-row">
          <span className="node-label" style={{ width: 50 }}>分辨率</span>
          <Select size="small" value={data.resolution || '720P'} style={{ flex: 1 }}
            options={[{ value: '720P', label: '720P' }, { value: '1080P', label: '1080P' }]}
            onChange={(v) => update({ resolution: v })} />
        </div>
      )}
      <div className="node-row">
        <span className="node-label" style={{ width: 50 }}>Seed</span>
        <InputNumber size="small" value={data.seed ?? -1} min={-1} max={2147483647} style={{ flex: 1 }}
          onChange={(v) => update({ seed: v as number })} />
      </div>
      <Input.TextArea size="small" rows={2} placeholder="提示词"
        value={data.prompt || ''} onChange={(e) => update({ prompt: e.target.value })} />

      {isFL ? (
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

export default JimengNode;
