/** DataFlowAnimation — 粒子沿 ReactFlow 边流动的动画叠加层。
 *
 * 通过 SVG overlay 在 ReactFlow 画布上层绘制流动粒子：
 * - 执行中 edges → cyan 霓虹色粒子脉冲
 * - 已完成 edges → green 流光粒子
 * - 失败 edges   → red 闪烁粒子
 * - 支持多条边同时流动，粒子颜色渐变，速度可调
 *
 * 接受 ReactFlow 的 nodes/edges 列表 + 节点坐标实时计算粒子路径。
 */
import { useMemo, useCallback, useRef } from 'react';
import type { Node, Edge } from 'reactflow';

export type EdgeStatus = 'idle' | 'executing' | 'success' | 'error';

type Props = {
  nodes: Node[];
  edges: Edge[];
  edgeStatuses: Record<string, EdgeStatus>;
  /** 粒子流动速度，像素/秒，默认 120 */
  speed?: number;
  /** 每段边上的粒子数，默认 6 */
  particleCount?: number;
};

/* ---------- 粒子状态 hook ---------- */
function useParticles(
  nodes: Node[],
  edges: Edge[],
  edgeStatuses: Record<string, EdgeStatus>,
  speed: number,
  particleCount: number,
): Array<{ edgeId: string; x: number; y: number; color: string; opacity: number; size: number }> {
  const frameRef = useRef<number>(0);
  const phaseRef = useRef<Record<string, number>>({});

  return useMemo(() => {
    const nodePos = new Map<string, { x: number; y: number; w: number; h: number }>();
    for (const n of nodes) {
      nodePos.set(n.id, {
        x: n.position.x + (n.width ?? 200) / 2,
        y: n.position.y + (n.height ?? 100) / 2,
        w: n.width ?? 200,
        h: n.height ?? 100,
      });
    }

    const active = edges.filter((e) => edgeStatuses[e.id] && edgeStatuses[e.id] !== 'idle');
    const particles: Array<{ edgeId: string; x: number; y: number; color: string; opacity: number; size: number }> = [];

    for (const e of active) {
      const src = nodePos.get(e.source);
      const tgt = nodePos.get(e.target);
      if (!src || !tgt) continue;
      const st = edgeStatuses[e.id];
      // 颜色映射
      const colorMap: Record<string, string> = {
        executing: '#00e5ff',
        success: '#69f0ae',
        error: '#ff5252',
      };
      const baseColor = colorMap[st] || '#00e5ff';

      const dx = tgt.x - src.x;
      const dy = tgt.y - src.y;

      for (let i = 0; i < particleCount; i++) {
        // 每帧偏移
        const phaseKey = `${e.id}_${i}`;
        const phase = phaseRef.current[phaseKey] ?? (phaseRef.current[phaseKey] = Math.random());
        const t = ((phase + (frameRef.current % 1000) / 1000 * speed / 100) % 1);

        const px = src.x + dx * t;
        const py = src.y + dy * t;

        // 粒子颜色渐变
        const hueShift = i * (360 / particleCount);
        const color = colorMap[st] === '#00e5ff'
          ? `hsl(${(190 + hueShift) % 360}, 100%, 65%)`
          : baseColor;

        particles.push({
          edgeId: e.id,
          x: px,
          y: py,
          color,
          opacity: 0.5 + 0.5 * Math.sin(t * Math.PI * 2),
          size: 3 + Math.sin(t * Math.PI * 2) * 2,
        });
      }
    }
    return particles;
  }, [nodes, edges, edgeStatuses, speed, particleCount]);
}

export default function DataFlowAnimation({
  nodes,
  edges,
  edgeStatuses,
  speed = 120,
  particleCount = 6,
}: Props) {
  const particles = useParticles(nodes, edges, edgeStatuses, speed, particleCount);

  // 只渲染有状态的边（idle 的跳过）
  const activeEdges = useMemo(
    () => edges.filter((e) => edgeStatuses[e.id] && edgeStatuses[e.id] !== 'idle'),
    [edges, edgeStatuses],
  );

  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 5,
      }}
    >
      <defs>
        {/* 霓虹发光滤镜 */}
        <filter id="neonGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        {/* 粒子渐变模板 */}
        <radialGradient id="particleGradCyan" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#00e5ff" stopOpacity="1" />
          <stop offset="100%" stopColor="#00e5ff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="particleGradGreen" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#69f0ae" stopOpacity="1" />
          <stop offset="100%" stopColor="#69f0ae" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="particleGradRed" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ff5252" stopOpacity="1" />
          <stop offset="100%" stopColor="#ff5252" stopOpacity="0" />
        </radialGradient>
      </defs>

      {activeEdges.map((e) => {
        const st = edgeStatuses[e.id];
        return (
          <g key={`edge-${e.id}`}>
            {/* 执行中的霓虹色脉冲辉光 */}
            {st === 'executing' && (
              <line
                x1={0} y1={0} x2={0} y2={0}
                stroke="url(#edgeGradientCyan)"
                strokeWidth={4}
                opacity={0.6}
                filter="url(#neonGlow)"
                style={{ display: 'none' }}
              />
            )}
          </g>
        );
      })}

      {/* 粒子渲染 */}
      {particles.map((p, idx) => (
        <circle
          key={`p-${p.edgeId}-${idx}`}
          cx={p.x}
          cy={p.y}
          r={p.size}
          fill={p.color}
          opacity={p.opacity}
          filter="url(#neonGlow)"
        >
          <animate
            attributeName="opacity"
            values={`${p.opacity * 0.7};${p.opacity};${p.opacity * 0.7}`}
            dur={`${0.5 + Math.random() * 0.5}s`}
            repeatCount="indefinite"
          />
        </circle>
      ))}
    </svg>
  );
}