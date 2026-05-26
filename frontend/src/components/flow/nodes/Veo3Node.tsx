import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { Input, Select } from 'antd';
import NodeShell from './shared/NodeShell';
import { useFlowStore } from '../../../store/flowStore';
import { VEO3_MODELS, normalizeGenerationMode } from '../../../utils/modelOptions';

type Data = {
  prompt?: string;
  model?: string;
  aspect_ratio?: '16:9' | '9:16';
  enhance_prompt?: boolean;
  enable_upsample?: boolean;
  mode?: 'image2video' | 'first_last';
  generation_mode?: 'image_to_video' | 'first_last_frame';
};

const Veo3Node = memo(function Veo3Node({ id, data, selected }: NodeProps<Data>) {
  const updateNodeData = useFlowStore((s) => s.updateNodeData);
  const update = (patch: Partial<Data>) => updateNodeData(id, patch as Record<string, unknown>, { syncSelectedType: true });

  const model = data.model || 'veo_3_1';
  const mode = normalizeGenerationMode(data.mode, data.generation_mode, 'image2video') as 'image2video' | 'first_last';
  const isFL = mode === 'first_last';

  return (
    <NodeShell type="veo3" selected={selected} title="Veo3 生视频" color="#42a5f5" variant="veo3" nodeId={id}>
      <div className="node-row">
        <span className="node-label" style={{ width: 60 }}>模式</span>
        <Select size="small" value={mode} style={{ flex: 1 }}
          options={[
            { value: 'image2video', label: '图生视频' },
            { value: 'first_last', label: '首尾帧' },
          ]}
          onChange={(v) => update({ mode: v })} />
      </div>
      <div className="node-row">
        <span className="node-label" style={{ width: 60 }}>模型</span>
        <Select size="small" value={model} style={{ flex: 1 }}
          options={VEO3_MODELS.map((m) => ({ value: m, label: m }))}
          onChange={(v) => update({ model: v })} />
      </div>
      <div className="node-row">
        <span className="node-label" style={{ width: 60 }}>宽高比</span>
        <Select size="small" value={data.aspect_ratio || '16:9'} style={{ flex: 1 }}
          options={[{ value: '16:9', label: '16:9' }, { value: '9:16', label: '9:16' }]}
          onChange={(v) => update({ aspect_ratio: v })} />
      </div>
      <div className="node-row">
        <span className="node-label" style={{ width: 60 }}>中转英</span>
        <Select size="small" value={data.enhance_prompt !== false ? 'yes' : 'no'} style={{ flex: 1 }}
          options={[{ value: 'yes', label: '是' }, { value: 'no', label: '否' }]}
          onChange={(v) => update({ enhance_prompt: v === 'yes' })} />
      </div>
      <div className="node-row">
        <span className="node-label" style={{ width: 60 }}>视频超分</span>
        <Select size="small" value={data.enable_upsample !== false ? 'yes' : 'no'} style={{ flex: 1 }}
          options={[{ value: 'yes', label: '是' }, { value: 'no', label: '否' }]}
          onChange={(v) => update({ enable_upsample: v === 'yes' })} />
      </div>
      <Input.TextArea size="small" rows={2} placeholder="提示词（中文会自动转英文）"
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

export default Veo3Node;
