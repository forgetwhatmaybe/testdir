import { useMemo, type CSSProperties, type ReactNode, memo } from 'react';
import { useTaskStore, type NodeStatus } from '../../../../store/taskStore';

/** 节点类型变体 → 标题栏渐变色 class */
type NodeVariant =
  | 'image' | 'video' | 'audio' | 'text'
  | 'kling' | 'jimeng' | 'gemini' | 'veo3' | 'seedance'
  | 'output' | 'storyboard' | 'edit';

type Props = {
  type: string;
  selected?: boolean;
  title: string;
  color: string;
  variant?: NodeVariant;
  outputId?: string;
  nodeId?: string;
  children?: ReactNode;
};

/** 状态 → 样式映射 */
const STATUS_STYLES: Record<NodeStatus['status'], {
  dotColor: string;
  dotClass: string;
  borderColor: string;
  borderClass: string;
  icon: string;
}> = {
  idle: {
    dotColor: '#555',
    dotClass: '',
    borderColor: 'transparent',
    borderClass: '',
    icon: '○',
  },
  queued: {
    dotColor: '#90a4ae',
    dotClass: 'status-queued',
    borderColor: 'rgba(144, 164, 174, 0.4)',
    borderClass: 'border-queued',
    icon: '◌',
  },
  executing: {
    dotColor: '#2196f3',
    dotClass: 'status-executing',
    borderColor: '#2196f3',
    borderClass: 'border-executing',
    icon: '◉',
  },
  success: {
    dotColor: '#4caf50',
    dotClass: 'status-success',
    borderColor: '#4caf50',
    borderClass: 'border-success',
    icon: '✓',
  },
  error: {
    dotColor: '#f44336',
    dotClass: 'status-error',
    borderColor: '#f44336',
    borderClass: 'border-error',
    icon: '✕',
  },
  cancelled: {
    dotColor: '#ff9800',
    dotClass: 'status-cancelled',
    borderColor: 'rgba(255, 152, 0, 0.4)',
    borderClass: 'border-cancelled',
    icon: '⊘',
  },
};

const NodeShell = memo(function NodeShell({ selected, title, color, variant, outputId, nodeId, children }: Props) {
  const tasks = useTaskStore((s) => s.tasks);
  const nodeStatuses = useTaskStore((s) => s.nodeStatuses);
  const isHighPerformance = useMemo(() => {
    // 高性能模式：节点数 > 50 时移除复杂效果
    const nodeCount = Object.keys(nodeStatuses).length;
    return nodeCount > 50;
  }, [nodeStatuses]);

  // 确定节点状态
  const nodeStatus: NodeStatus | undefined = useMemo(() => {
    // 优先按 nodeId 精确查找
    if (nodeId && nodeStatuses[nodeId]) return nodeStatuses[nodeId];
    // 兜底：按 outputId 关联的任务状态推断
    if (outputId) {
      const task = Object.values(tasks).find((t) => t.output_node_id === outputId);
      if (task) {
        const map: Record<string, NodeStatus['status']> = {
          queued: 'queued',
          running: 'executing',
          done: 'success',
          failed: 'error',
          cancelled: 'cancelled',
        };
        return { status: map[task.status] || 'idle', progress: task.progress || 0 };
      }
    }
    return undefined;
  }, [nodeId, outputId, nodeStatuses, tasks]);

  const status = nodeStatus?.status || 'idle';
  const st = STATUS_STYLES[status];

  const cls = ['node-shell'];
  if (selected) cls.push('selected');
  if (!isHighPerformance) {
    if (status === 'executing' || status === 'queued') cls.push('running');
    if (status === 'error') cls.push('failed');
    if (status === 'success') cls.push('success-node');
  }

  const style: CSSProperties = {
    borderTopColor: isHighPerformance ? undefined : color,
    ...(status !== 'idle' && !isHighPerformance ? {
      boxShadow: `0 0 12px ${st.borderColor}, 0 0 24px ${st.borderColor}33, inset 0 0 8px ${st.borderColor}11`,
    } : {}),
  };

  return (
    <div className={`${cls.join(' ')} ${st.borderClass}`} style={style}>
      <div className={`node-title${variant ? ` node-title-bar-${variant}` : ''}`}>
        {/* 状态指示灯 */}
        <span
          className={`node-status-dot ${st.dotClass}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 12,
            height: 12,
            borderRadius: '50%',
            background: st.dotColor,
            marginRight: 6,
            fontSize: 8,
            fontWeight: 'bold',
            color: status === 'success' || status === 'error' ? '#fff' : 'transparent',
            transition: 'all 0.3s ease',
            flexShrink: 0,
          }}
        >
          {status === 'success' ? '✓' : status === 'error' ? '✕' : ''}
        </span>
        <span className="dot" style={{ background: color }} />
        <span style={{ flex: 1 }}>{title}</span>
        {/* 进度百分比 */}
        {nodeStatus && nodeStatus.status === 'executing' && (
          <span className="node-progress-badge">{nodeStatus.progress}%</span>
        )}
      </div>
      {children}
    </div>
  );
});

export default NodeShell;