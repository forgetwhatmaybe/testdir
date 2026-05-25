import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactFlow, {
  Background, Controls, MarkerType, MiniMap, ReactFlowProvider,
  type Connection, type Edge, type Node, type ReactFlowInstance,
} from 'reactflow';
import { App as AntApp } from 'antd';
import { useFlowStore } from '../../store/flowStore';
import { useTaskStore } from '../../store/taskStore';
import { nodeTypes, nodeMeta } from './nodes/index';
import DataFlowEdge from './edges/DataFlowEdge';
import { isValidConnection } from '../../utils/connectionRules';
import { uniqueId, nextOutputName, nextTextOutputName } from '../../utils/nodeNaming';
import { collectConnected } from '../../utils/upstreamWalker';
import { useShortcuts } from '../../hooks/useShortcuts';
import { useProjectStore } from '../../store/projectStore';
import { uploadFile } from '../../api/files';

export interface TemplateNode {
  id: string;
  type: string;
  node_type?: string;
  label?: string;
  params?: Record<string, unknown>;
  data?: Record<string, unknown>;
  position?: { x: number; y: number };
  subgraph?: TemplateNode[];
}

export interface TemplateData {
  name: string;
  nodes: TemplateNode[];
  edges?: { source: string; target: string; sourceHandle?: string; targetHandle?: string }[];
}

type Props = {
  saveNow: () => Promise<void>;
  pendingTemplate: TemplateData | null;
  onTemplatePlaced(): void;
  registerLocate(fn: (id: string) => void): void;
  /** v4: 执行当前工作流的回调（Ctrl+E 快捷键） */
  executeWorkflow?: () => void;
};

const QUICK_ADD_GROUPS: { label: string; types: string[] }[] = [
  { label: '素材', types: ['image', 'video', 'audio'] },
  { label: '生视频', types: ['kling', 'jimeng', 'veo3', 'seedance2'] },
  { label: '生图', types: ['gemini', 'image_edit'] },
  { label: '文本', types: ['text_vision', 'text_display'] },
  { label: '输出', types: ['output'] },
];

interface NodeStatusEntry {
  status?: string;
  progress?: number;
  message?: string;
  error?: string;
}

// TapNow 拓扑布局间距常量
const HORIZONTAL_SPACING = 200; // 水平间距
const VERTICAL_SPACING = 80;    // 垂直间距

// 计算节点层级和位置
function computeNodeLevels(nodes: Node[], edges: Edge[]): Map<string, number> {
  const levelMap = new Map<string, number>();
  const inDegree = new Map<string, number>();
  const graph = new Map<string, string[]>();
  
  // 初始化
  nodes.forEach(n => {
    inDegree.set(n.id, 0);
    graph.set(n.id, []);
  });
  
  // 构建图
  edges.forEach(edge => {
    const source = edge.source;
    const target = edge.target;
    if (graph.has(source) && graph.has(target)) {
      graph.get(source)!.push(target);
      inDegree.set(target, (inDegree.get(target) || 0) + 1);
    }
  });
  
  // 拓扑排序
  const queue: string[] = [];
  inDegree.forEach((deg, id) => {
    if (deg === 0) queue.push(id);
  });
  
  let level = 0;
  while (queue.length > 0) {
    const nextQueue: string[] = [];
    for (const nodeId of queue) {
      levelMap.set(nodeId, level);
      for (const neighbor of graph.get(nodeId) || []) {
        inDegree.set(neighbor, inDegree.get(neighbor)! - 1);
        if (inDegree.get(neighbor) === 0) {
          nextQueue.push(neighbor);
        }
      }
    }
    queue.length = 0;
    queue.push(...nextQueue);
    level++;
  }
  
  // 处理孤立节点
  nodes.forEach(n => {
    if (!levelMap.has(n.id)) {
      levelMap.set(n.id, 0);
    }
  });
  
  return levelMap;
}

// 边类型注册 — 仅创建一次避免每 render 生成新对象
const edgeTypes = { default: DataFlowEdge };

function getActiveTask(nodeStatuses: Record<string, NodeStatusEntry>): string {
  // 检测是否有活跃的任务在执行中
  for (const [, s] of Object.entries(nodeStatuses)) {
    if (s?.status === 'executing' || s?.status === 'running' || s?.status === 'queued') return 'executing';
  }
  // 检查是否最近有失败
  for (const [, s] of Object.entries(nodeStatuses)) {
    if (s?.status === 'error' || s?.status === 'failed') return 'failed';
  }
  // 检查是否全部成功
  const statuses = Object.values(nodeStatuses).filter((s) => s?.status);
  if (statuses.length > 0 && statuses.every((s: NodeStatusEntry) => s.status === 'success' || s.status === 'done')) {
    return 'success';
  }
  return 'idle';
}

function InnerCanvas({ saveNow, pendingTemplate, onTemplatePlaced, registerLocate, executeWorkflow }: Props) {
  const { message } = AntApp.useApp();
  const project = useProjectStore((s) => s.current);
  const wrapper = useRef<HTMLDivElement>(null);
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null);
  const [paneMenu, setPaneMenu] = useState<{ x: number; y: number; flowX: number; flowY: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const nodes = useFlowStore((s) => s.nodes);
  const edges = useFlowStore((s) => s.edges);
  const setNodes = useFlowStore((s) => s.setNodes);
  const setEdges = useFlowStore((s) => s.setEdges);
  const onNodesChange = useFlowStore((s) => s.onNodesChange);
  const onEdgesChange = useFlowStore((s) => s.onEdgesChange);
  const setViewport = useFlowStore((s) => s.setViewport);
  const pushHistory = useFlowStore((s) => s.pushHistory);
  const nodeStatuses = useTaskStore((s) => s.nodeStatuses);

  const activeStatus = getActiveTask(nodeStatuses);

  useShortcuts(saveNow, executeWorkflow);

  useEffect(() => {
    registerLocate((id: string) => {
      if (!rfInstance) return;
      const n = useFlowStore.getState().nodes.find((nn) => nn.id === id);
      if (!n) return;
      rfInstance.setCenter(n.position.x + 100, n.position.y + 80, { zoom: 1, duration: 300 });
      setNodes(useFlowStore.getState().nodes.map((nn) => ({ ...nn, selected: nn.id === id })));
    });
  }, [rfInstance, registerLocate, setNodes]);

  // 初始化时仅打一次 mask_output 补丁（避免用 nodes 依赖触发 setNodes 形成回流）
  useEffect(() => {
    const { nodes, setNodes } = useFlowStore.getState();
    let dirty = false;
    const fixed = nodes.map((n) => {
      if (n.type === 'image' && (n.data as any)?.mask_path && !(n.data as any)?.has_mask_output) {
        dirty = true;
        return { ...n, data: { ...(n.data as any), has_mask_output: true } };
      }
      return n;
    });
    if (dirty) setNodes(fixed);
  }, []);

  const onConnect = useCallback((conn: Connection) => {
    const valid = isValidConnection(conn, useFlowStore.getState().nodes, useFlowStore.getState().edges);
    if (!valid) {
      message.warning('连线不合法（类型不符 / 输入口已占满）');
      return;
    }
    const newEdge: Edge = {
      ...(conn as Edge),
      id: `e_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: 'default',
    };
    setEdges([...useFlowStore.getState().edges, newEdge]);
    pushHistory();
  }, [setEdges, pushHistory, message]);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    if (!rfInstance) return;
    const pos = rfInstance.screenToFlowPosition({ x: e.clientX, y: e.clientY });

    const type = e.dataTransfer.getData('application/reactflow-node-type');
    if (type) {
      addNodeAt(type, pos.x, pos.y);
      return;
    }

    const files = Array.from(e.dataTransfer.files || []);
    if (!files.length || !project) return;
    let offset = 0;
    for (const f of files) {
      const ext = f.name.toLowerCase().split('.').pop() || '';
      const isVideo = ['mp4', 'mov', 'avi', 'mkv', 'wmv', 'flv', 'webm'].includes(ext);
      const isImage = ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif'].includes(ext);
      const isAudio = ['mp3', 'wav', 'm4a', 'flac', 'ogg', 'aac'].includes(ext);
      if (!isVideo && !isImage && !isAudio) continue;
      try {
        const r = await uploadFile(project, f);
        const id = uniqueId('n');
        const t = isVideo ? 'video' : isAudio ? 'audio' : 'image';
        const data: any = isVideo ? { video_path: r.rel_path }
          : isAudio ? { audio_path: r.rel_path }
          : { image_path: r.rel_path };
        const newNode: Node = {
          id, type: t,
          position: { x: pos.x + offset, y: pos.y + offset },
          data,
        };
        setNodes([...useFlowStore.getState().nodes, newNode]);
        offset += 24;
      } catch (err: any) {
        message.error(err.message);
      }
    }
    pushHistory();
  }, [rfInstance, project, setNodes, pushHistory, message]);

  const addNodeAt = useCallback((type: string, x: number, y: number) => {
    const id = uniqueId('n');
    const data: Record<string, unknown> = {};
    if (type === 'output') data.name = nextOutputName(useFlowStore.getState().nodes);
    if (type === 'text_display') data.name = nextTextOutputName(useFlowStore.getState().nodes);
    const newNode: Node = { id, type, position: { x, y }, data };
    setNodes([...useFlowStore.getState().nodes, newNode]);
    pushHistory();
  }, [setNodes, pushHistory]);

  const onNodeClick = useCallback((e: React.MouseEvent, node: Node) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const ids = collectConnected(node.id, useFlowStore.getState().nodes, useFlowStore.getState().edges);
      setNodes(useFlowStore.getState().nodes.map((n) => ({ ...n, selected: ids.has(n.id) })));
    }
  }, [setNodes]);

  const onPaneClick = useCallback((e: React.MouseEvent) => {
    setPaneMenu(null);
    if (!pendingTemplate || !rfInstance) return;
    const pos = rfInstance.screenToFlowPosition({ x: e.clientX, y: e.clientY });
    const tpl = pendingTemplate;
    const minX = Math.min(...tpl.nodes.map((n) => n.position?.x ?? 0));
    const minY = Math.min(...tpl.nodes.map((n) => n.position?.y ?? 0));
    const idMap = new Map<string, string>();
    const allNodes = [...useFlowStore.getState().nodes];
    const newNodes: Node[] = tpl.nodes.map((n) => {
      const newId = uniqueId('n');
      idMap.set(n.id, newId);
      const data: Record<string, unknown> = { ...(n.data || {}) };
      if (n.type === 'output') {
        data.name = nextOutputName(allNodes);
        allNodes.push({ id: newId, type: n.type, position: { x: 0, y: 0 }, data } as Node);
      }
      if (n.type === 'text_display') {
        data.name = nextTextOutputName(allNodes);
        allNodes.push({ id: newId, type: n.type, position: { x: 0, y: 0 }, data } as Node);
      }
      return {
        id: newId, type: n.type,
        position: { x: pos.x + ((n.position?.x ?? 0) - minX), y: pos.y + ((n.position?.y ?? 0) - minY) },
        data,
      };
    });
    const newEdges: Edge[] = (tpl.edges || []).map((eg) => ({
      id: `e_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      source: idMap.get(eg.source)!,
      sourceHandle: eg.sourceHandle,
      target: idMap.get(eg.target)!,
      targetHandle: eg.targetHandle,
    }));
    setNodes([...useFlowStore.getState().nodes, ...newNodes]);
    setEdges([...useFlowStore.getState().edges, ...newEdges]);
    pushHistory();
    onTemplatePlaced();
  }, [pendingTemplate, rfInstance, setNodes, setEdges, pushHistory, onTemplatePlaced]);

  const onPaneContextMenu = useCallback((e: React.MouseEvent | MouseEvent) => {
    if (!rfInstance) return;
    e.preventDefault();
    const pos = rfInstance.screenToFlowPosition({ x: e.clientX, y: e.clientY });
    setPaneMenu({ x: e.clientX, y: e.clientY, flowX: pos.x, flowY: pos.y });
  }, [rfInstance]);

  // 动态边样式 — TapNow 极简风格
  const styledEdges = useMemo(() => {
    const markerColor = activeStatus === 'success' ? '#22c55e'
      : activeStatus === 'failed' ? '#ef4444'
      : activeStatus === 'executing' ? '#3b82f6'
      : '#94a3b8';

    return edges.map(edge => ({
      ...edge,
      type: 'default' as string,
      style: {
        strokeWidth: activeStatus === 'executing' ? 2 : 1.5,
        stroke: markerColor,
        transition: 'all 0.2s ease',
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 10,
        height: 10,
        color: markerColor,
      },
      animated: activeStatus === 'executing',
    }));
  }, [edges, activeStatus]);

  // SVG 渐变定义 — TapNow 极简
  const svgDefs = useMemo(() => {
    return (
      <svg style={{ position: 'absolute', width: 0, height: 0 }}>
        <defs>
          <linearGradient id="edgeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#8b5cf6" />
          </linearGradient>
        </defs>
      </svg>
    );
  }, []);

  return (
    <div ref={wrapper} className={`flow-canvas${isDragging ? ' dragging' : ''}`} style={{ width: '100%', height: '100%', cursor: pendingTemplate ? 'crosshair' : 'default', position: 'relative' }}>
      {svgDefs}
        <ReactFlow
        nodes={nodes}
        edges={styledEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onInit={setRfInstance}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onPaneContextMenu={onPaneContextMenu}
        onNodeDragStart={() => setIsDragging(true)}
        onNodeDragStop={() => setIsDragging(false)}
        onMoveEnd={(_, vp) => setViewport(vp)}
        deleteKeyCode={null}
        zoomActivationKeyCode={null}
        panOnScroll={false}
        zoomOnScroll
        zoomOnPinch
        panOnDrag={[1, 2]}
        proOptions={{ hideAttribution: true }}
        noDragClassName="ant-select-dropdown, .ant-select-item, .ant-select-selection-item, .ant-input, .ant-input-number-input, .ant-slider, .ant-btn, .ant-modal-content, .ant-dropdown-menu"
        fitView
        minZoom={0.1}
        maxZoom={3}
        nodeExtent={[[-1000, -1000], [5000, 5000]]}
        defaultEdgeOptions={{
          type: 'default',
          style: { strokeWidth: 1.5, stroke: '#a0aec0' },
        }}
      >
        <Background 
          color="#e2e8f0" 
          gap={24}
          size={1}
          style={{ 
            background: '#f5f7fa',
          }}
        />
        <Controls
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          }}
        />
        <MiniMap 
          pannable 
          zoomable 
          maskColor="rgba(0,0,0,0.04)" 
          style={{ 
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          }}
        />
      </ReactFlow>

      {/* 全局执行状态覆盖层 */}
      {activeStatus === 'executing' && (
        <div className="flow-global-pulse" />
      )}

      {paneMenu && (
        <div
          onMouseLeave={() => setPaneMenu(null)}
          style={{
            position: 'fixed', left: paneMenu.x, top: paneMenu.y, zIndex: 200,
            background: '#1f1f1f', border: '1px solid #333', borderRadius: 4, padding: 4,
            boxShadow: '0 4px 16px rgba(0,0,0,0.5)', minWidth: 160,
          }}
        >
          {QUICK_ADD_GROUPS.map((g) => (
            <div key={g.label}>
              <div style={{ fontSize: 11, color: '#888', padding: '4px 8px' }}>{g.label}</div>
              {g.types.map((t) => (
                <div
                  key={t}
                  className="quick-add-item"
                  onClick={() => { addNodeAt(t, paneMenu.flowX, paneMenu.flowY); setPaneMenu(null); }}
                >
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: nodeMeta[t].color, marginRight: 6, display: 'inline-block' }} />
                  {nodeMeta[t].label}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function FlowCanvas(props: Props) {
  return (
    <ReactFlowProvider>
      <InnerCanvas {...props} />
    </ReactFlowProvider>
  );
}