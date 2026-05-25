import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { Input, Button, App as AntApp, Dropdown, Space } from 'antd';
import { CopyOutlined, PlayCircleOutlined } from '@ant-design/icons';
import NodeShell from './shared/NodeShell';
import { useFlowStore } from '../../../store/flowStore';
import { useProjectStore } from '../../../store/projectStore';
import { useTaskStore } from '../../../store/taskStore';
import { runTasks } from '../../../api/tasks';
import { estimateTokens } from '../../../utils/modelOptions';

type Data = { name?: string; text?: string };

const TextDisplayNode = memo(function TextDisplayNode({ id, data, selected }: NodeProps<Data>) {
  const { message } = AntApp.useApp();
  const nodes = useFlowStore((s) => s.nodes);
  const edges = useFlowStore((s) => s.edges);
  const updateNodeData = useFlowStore((s) => s.updateNodeData);
  const project = useProjectStore((s) => s.current);
  const tasks = useTaskStore((s) => s.tasks);

  const update = (patch: Partial<Data>) => updateNodeData(id, patch as Record<string, unknown>);

  const liveTask = Object.values(tasks).find((t) => t.output_node_id === id);
  const text = liveTask?.result_path && liveTask.status === 'done'
    ? data.text  // 文本由 result_path 的 .txt 内容映射，前端按需 fetch；这里以本地 text 为准
    : data.text;
  const tokens = estimateTokens(text || '');

  const onRun = async () => {
    if (!project) return;
    try {
      await runTasks(project, { version: 2, viewport: { x: 0, y: 0, zoom: 1 }, nodes, edges }, [id]);
      message.success('已加入任务队列');
    } catch (e: any) { message.error(e.message); }
  };

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(text || '');
      message.success('已复制');
    } catch { message.warning('剪贴板写入失败'); }
  };

  const items = [
    { key: 'run', label: '▶ 执行当前节点' },
    { key: 'run_all', label: '▶ 执行工作流' },
    { key: 'copy', label: '📋 复制文本', disabled: !text },
  ];

  return (
    <NodeShell type="text_display" selected={selected} title="文本显示" color="#9ccc65" variant="text" outputId={id} nodeId={id}>
      <Dropdown trigger={['contextMenu']} menu={{ items, onClick: (e) => {
        if (e.key === 'run' || e.key === 'run_all') onRun();
        else if (e.key === 'copy') onCopy();
      } }}>
        <div>
          <Input size="small" placeholder="名称" value={data.name || ''}
            onChange={(e) => update({ name: e.target.value })} style={{ marginBottom: 4 }} />
          <Input.TextArea
            value={text || ''}
            onChange={(e) => update({ text: e.target.value })}
            rows={5}
            placeholder="（执行后填充上游文本）"
            style={{ resize: 'none' }}
          />
        </div>
      </Dropdown>
      <div className="node-row" style={{ marginTop: 4 }}>
        <span className="node-token" style={{ flex: 1, textAlign: 'left' }}>tokens: {tokens}</span>
        <Space>
          <Button size="small" icon={<CopyOutlined />} onClick={onCopy} />
          <Button size="small" icon={<PlayCircleOutlined />} onClick={onRun} />
        </Space>
      </div>

      <Handle type="target" position={Position.Left} id="in_text" className="handle-text" />
      <Handle type="source" position={Position.Right} id="out" className="handle-text" />
    </NodeShell>
  );
});

export default TextDisplayNode;
