import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { Input, Select } from 'antd';
import NodeShell from './shared/NodeShell';
import ThumbStrip from './shared/ThumbStrip';
import { useFlowStore } from '../../../store/flowStore';
import {
  GEMINI_MODELS, GEMINI_ASPECT, GEMINI_SIZES, geminiSupportsImageSize, estimateTokens,
} from '../../../utils/modelOptions';
import { orderedRefs } from '../../../utils/refOrder';

type Data = {
  prompt?: string;
  model?: string;
  aspect_ratio?: string;
  image_size?: string;
  ref_order?: string[];
};

const GeminiNode = memo(function GeminiNode({ id, data, selected }: NodeProps<Data>) {
  const edges = useFlowStore((s) => s.edges);
  const updateNodeData = useFlowStore((s) => s.updateNodeData);
  const update = (patch: Partial<Data>) => updateNodeData(id, patch as Record<string, unknown>);

  const model = data.model || GEMINI_MODELS[0];
  const refIds = orderedRefs({ id, data, type: 'gemini', position: { x: 0, y: 0 } } as any, 'in_refs', edges);
  const tokens = estimateTokens(data.prompt || '');

  return (
    <NodeShell type="gemini" selected={selected} title="香蕉生图 (Gemini)" color="#ffb300" variant="gemini" nodeId={id}>
      <ThumbStrip nodeId={id} refNodeIds={refIds} mediaType="image" cols={4} size={40} />
      <div className="node-row">
        <span className="node-label" style={{ width: 50 }}>模型</span>
        <Select size="small" value={model} style={{ flex: 1 }}
          options={GEMINI_MODELS.map((m) => ({ value: m, label: m }))}
          onChange={(v) => update({ model: v })} />
      </div>
      <div className="node-row">
        <span className="node-label" style={{ width: 50 }}>宽高比</span>
        <Select size="small" value={data.aspect_ratio || '1:1'} style={{ flex: 1 }}
          options={GEMINI_ASPECT.map((a) => ({ value: a, label: a }))}
          onChange={(v) => update({ aspect_ratio: v })} />
      </div>
      {geminiSupportsImageSize(model) && (
        <div className="node-row">
          <span className="node-label" style={{ width: 50 }}>分辨率</span>
          <Select size="small" value={data.image_size || '2K'} style={{ flex: 1 }}
            options={GEMINI_SIZES.map((s) => ({ value: s, label: s }))}
            onChange={(v) => update({ image_size: v })} />
        </div>
      )}
      <Input.TextArea size="small" rows={3} placeholder="提示词"
        value={data.prompt || ''} onChange={(e) => update({ prompt: e.target.value })} />
      <div className="node-token">tokens: {tokens}</div>

      <Handle type="target" position={Position.Left} id="in_refs" className="handle-refs" />
      <Handle type="source" position={Position.Right} id="out" className="handle-image" />
    </NodeShell>
  );
});

export default GeminiNode;