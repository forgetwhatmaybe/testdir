import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { Input, Select, Slider } from 'antd';
import NodeShell from './shared/NodeShell';
import ThumbStrip from './shared/ThumbStrip';
import { useFlowStore } from '../../../store/flowStore';
import {
  TEXT_VISION_MODELS, thinkingOptions, FORMAT_MODES, estimateTokens,
} from '../../../utils/modelOptions';
import { orderedRefs } from '../../../utils/refOrder';

type Data = {
  prompt?: string;
  model?: string;
  thinking_mode?: string;
  format_mode?: string;
  temperature?: number;
  ref_order?: string[];
};

const TextVisionNode = memo(function TextVisionNode({ id, data, selected }: NodeProps<Data>) {
  const edges = useFlowStore((s) => s.edges);
  const updateNodeData = useFlowStore((s) => s.updateNodeData);
  const update = (patch: Partial<Data>) => updateNodeData(id, patch as Record<string, unknown>, { syncSelectedType: true });

  const model = data.model || 'gpt-5.4';
  const thinkingOpts = thinkingOptions(model);
  const thinkingDefault = model.startsWith('gpt') ? 'none' : 'low';
  const thinking = data.thinking_mode || thinkingDefault;
  const refIds = orderedRefs({ id, data, type: 'text_vision', position: { x: 0, y: 0 } } as any, 'in_image', edges);
  const tokens = estimateTokens(data.prompt || '');
  const showTemperature = !(model.startsWith('gpt') && thinking !== 'none');

  return (
    <NodeShell type="text_vision" selected={selected} title="文本识图" color="#26a69a" variant="text" nodeId={id}>
      <ThumbStrip nodeId={id} refNodeIds={refIds} mediaType="image" cols={4} size={40} />
      <div className="node-row">
        <span className="node-label" style={{ width: 60 }}>模型</span>
        <Select size="small" value={model} style={{ flex: 1 }}
          options={TEXT_VISION_MODELS.map((m) => ({ value: m, label: m }))}
          onChange={(v) => update({ model: v, thinking_mode: v.startsWith('gpt') ? 'none' : 'low' })} />
      </div>
      <div className="node-row">
        <span className="node-label" style={{ width: 60 }}>思考</span>
        <Select size="small" value={thinking} style={{ flex: 1 }}
          options={thinkingOpts.map((t) => ({ value: t, label: t }))}
          onChange={(v) => update({ thinking_mode: v })} />
      </div>
      <div className="node-row">
        <span className="node-label" style={{ width: 60 }}>格式</span>
        <Select size="small" value={data.format_mode || '无'} style={{ flex: 1 }}
          options={FORMAT_MODES.map((f) => ({ value: f, label: f }))}
          onChange={(v) => update({ format_mode: v })} />
      </div>
      {showTemperature && (
        <div className="node-row">
          <span className="node-label" style={{ width: 60 }}>温度</span>
          <Slider min={0} max={2} step={0.05} style={{ flex: 1 }}
            value={data.temperature ?? 0.8} onChange={(v) => update({ temperature: v as number })} />
          <span className="node-cfg-display">{(data.temperature ?? 0.8).toFixed(2)}</span>
        </div>
      )}
      <Input.TextArea size="small" rows={3} placeholder="提示词"
        value={data.prompt || ''} onChange={(e) => update({ prompt: e.target.value })} />
      <div className="node-token">tokens: {tokens}</div>

      <Handle type="target" position={Position.Left} id="in_image" className="handle-refs" />
      <Handle type="source" position={Position.Right} id="out" className="handle-text" />
    </NodeShell>
  );
});

export default TextVisionNode;
