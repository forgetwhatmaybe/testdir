/**
 * 数据流动画自定义边组件。
 *
 * 根据 taskStore.nodeStatuses 计算边的执行状态，驱动以下视觉：
 * - idle：灰色虚线静态
 * - executing：霓虹蓝脉冲虚线动画 + 粒子沿路径流动
 * - success：绿色实线 + 完成流光
 * - error：红色闪烁虚线
 */
import { type FC, useMemo } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from 'reactflow';
import { useTaskStore } from '../../../store/taskStore';

/** 边状态枚举 */
type EdgeFlowStatus = 'idle' | 'executing' | 'success' | 'error';

/** 状态→配色 */
const STATUS_THEME: Record<EdgeFlowStatus, {
  stroke: string;
  glow: string;
  dashArray: string;
  animationClass: string;
  particleColor: string;
}> = {
  idle: {
    stroke: '#444',
    glow: 'none',
    dashArray: '8 4',
    animationClass: '',
    particleColor: '#555',
  },
  executing: {
    stroke: '#2196f3',
    glow: '0 0 8px rgba(33, 150, 243, 0.8), 0 0 16px rgba(33, 150, 243, 0.4)',
    dashArray: '10 5',
    animationClass: 'anim-dash-fast',
    particleColor: '#4fc3f7',
  },
  success: {
    stroke: '#4caf50',
    glow: '0 0 6px rgba(76, 175, 80, 0.6)',
    dashArray: 'none',
    animationClass: '',
    particleColor: '#81c784',
  },
  error: {
    stroke: '#f44336',
    glow: '0 0 8px rgba(244, 67, 54, 0.8), 0 0 16px rgba(244, 67, 54, 0.4)',
    dashArray: '4 6',
    animationClass: 'anim-dash-flash',
    particleColor: '#ef5350',
  },
};

/**
 * 根据 taskStore 中的节点状态推断这条边的执行状态。
 * 规则：source 和 target 节点都为 success → success
 *       target 为 executing → executing
 *       target 为 error → error
 *       其余 → idle
 */
function resolveEdgeStatus(
  source: string,
  target: string,
  nodeStatuses: Record<string, any>,
): EdgeFlowStatus {
  const ts = nodeStatuses[target]?.status;
  const ss = nodeStatuses[source]?.status;

  if (ts === 'error' || ss === 'error') return 'error';
  if (ts === 'executing' || ts === 'running') return 'executing';
  if (ts === 'queued') return 'executing';
  if (ts === 'success' && ss === 'success') return 'success';
  if (ss === 'executing' || ss === 'running') return 'executing';

  return 'idle';
}

/**
 * 沿贝塞尔曲线生成 N 个均匀分布的点（用于粒子放置，offset-path 兼容格式）。
 */
function sampleBezier(
  x1: number, y1: number,
  x2: number, y2: number,
  sourceX: number, sourceY: number,
  targetX: number, targetY: number,
  count: number,
): Array<{ x: number; y: number }> {
  const dx = Math.abs(targetX - sourceX);
  const [cp1x, cp1y, cp2x, cp2y] = [x1, y1, x2, y2];

  const points: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < count; i++) {
    const t = i / count;
    const u = 1 - t;
    const px = u * u * u * sourceX + 3 * u * u * t * cp1x + 3 * u * t * t * cp2x + t * t * t * targetX;
    const py = u * u * u * sourceY + 3 * u * u * t * cp1y + 3 * u * t * t * cp2y + t * t * t * targetY;
    points.push({ x: px, y: py });
  }
  return points;
}

const DataFlowEdge: FC<EdgeProps> = ({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  style,
}) => {
  const nodeStatuses = useTaskStore((s) => s.nodeStatuses);

  const status = useMemo(
    () => resolveEdgeStatus(source, target, nodeStatuses),
    [source, target, nodeStatuses],
  );

  const theme = STATUS_THEME[status];

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  // 计算贝塞尔控制点
  const dx = Math.abs(targetX - sourceX);
  const offset = Math.max(200, dx * 0.5);
  const cp1x = sourcePosition === 'right' ? sourceX + offset : sourceX - offset;
  const cp1y = sourceY;
  const cp2x = targetPosition === 'left' ? targetX - offset : targetX + offset;
  const cp2y = targetY;

  // 仅在 executing 状态生成粒子
  const particles = useMemo(() => {
    if (status !== 'executing') return [];
    return sampleBezier(cp1x, cp1y, cp2x, cp2y, sourceX, sourceY, targetX, targetY, 8);
  }, [status, cp1x, cp1y, cp2x, cp2y, sourceX, sourceY, targetX, targetY]);

  return (
    <>
      {/* 霓虹光晕底层 */}
      {status !== 'idle' && (
        <path
          d={edgePath}
          fill="none"
          stroke={theme.stroke}
          strokeWidth={6}
          strokeOpacity={0.15}
          filter={theme.glow}
          style={{ pointerEvents: 'none' }}
        />
      )}

      {/* 主路径 */}
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: theme.stroke,
          strokeWidth: status === 'executing' ? 2.5 : 2,
          strokeDasharray: theme.dashArray,
          filter: theme.glow,
          transition: 'all 0.5s ease',
          ...style,
        }}
        markerEnd={markerEnd}
      />

      {/* 执行中粒子 */}
      {status === 'executing' &&
        particles.map((p, i) => (
          <circle
            key={`${id}-particle-${i}`}
            cx={p.x}
            cy={p.y}
            r={2.5}
            fill={theme.particleColor}
            opacity={0}
            style={{
              pointerEvents: 'none',
            }}
          >
            <animate
              attributeName="opacity"
              values="0;1;0"
              dur="1.5s"
              begin={`${i * 0.2}s`}
              repeatCount="indefinite"
            />
            <animate
              attributeName="r"
              values="1.5;3;1.5"
              dur="1.5s"
              begin={`${i * 0.2}s`}
              repeatCount="indefinite"
            />
          </circle>
        ))}

      {/* 成功绿色流光扫描 */}
      {status === 'success' && (
        <>
          <path
            d={edgePath}
            fill="none"
            stroke="#81c784"
            strokeWidth={3}
            strokeOpacity={0}
            strokeDasharray="30 150"
            style={{ pointerEvents: 'none' }}
          >
            <animate
              attributeName="stroke-opacity"
              values="0;0.6;0"
              dur="2s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="stroke-dashoffset"
              values="0;-180"
              dur="2s"
              repeatCount="indefinite"
            />
          </path>
        </>
      )}

      {/* 错误红色闪烁扫描 */}
      {status === 'error' && (
        <>
          <path
            d={edgePath}
            fill="none"
            stroke="#ef5350"
            strokeWidth={4}
            strokeOpacity={0}
            strokeDasharray="20 80"
            style={{ pointerEvents: 'none' }}
          >
            <animate
              attributeName="stroke-opacity"
              values="0;0.8;0;0.8;0"
              dur="0.6s"
              repeatCount="indefinite"
            />
          </path>
        </>
      )}
    </>
  );
};

export default DataFlowEdge;