import { create } from 'zustand';
import type { Node, Edge, Viewport, NodeChange, EdgeChange, Connection } from 'reactflow';
import { applyNodeChanges, applyEdgeChanges, addEdge } from 'reactflow';

export type FlowSnapshot = {
  nodes: Node[];
  edges: Edge[];
  viewport: Viewport;
};

type FlowState = FlowSnapshot & {
  setNodes(nodes: Node[]): void;
  setEdges(edges: Edge[]): void;
  setViewport(v: Viewport): void;
  onNodesChange(changes: NodeChange[]): void;
  onEdgesChange(changes: EdgeChange[]): void;
  onConnect(conn: Connection): void;
  loadSnapshot(s: FlowSnapshot): void;
  // 撤销/重做
  history: FlowSnapshot[];
  pointer: number;
  pushHistory(): void;
  undo(): void;
  redo(): void;
  // 剪贴板
  clipboard: { nodes: Node[]; edges: Edge[] } | null;
  setClipboard(c: { nodes: Node[]; edges: Edge[] } | null): void;
  // 节点删除/复制
  deleteNode(nodeId: string): void;
  duplicateNode(nodeId: string): void;
  // 高效更新节点数据（避免全量 nodes.map）
  updateNodeData(nodeId: string, patch: Record<string, unknown>): void;
};

export const useFlowStore = create<FlowState>((set, get) => ({
  nodes: [],
  edges: [],
  viewport: { x: 0, y: 0, zoom: 1 },

  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),
  setViewport: (viewport) => set({ viewport }),

  onNodesChange: (changes) => set({ nodes: applyNodeChanges(changes, get().nodes) }),
  onEdgesChange: (changes) => set({ edges: applyEdgeChanges(changes, get().edges) }),
  onConnect: (conn) => set({ edges: addEdge({ ...conn, id: `e${Date.now()}_${Math.random().toString(36).slice(2, 6)}` }, get().edges) }),

  loadSnapshot: (s) => set({ nodes: s.nodes, edges: s.edges, viewport: s.viewport, history: [s], pointer: 0 }),

  history: [],
  pointer: -1,
  pushHistory: () => {
    const { nodes, edges, viewport, history, pointer } = get();
    const snap: FlowSnapshot = { nodes, edges, viewport };
    if (typeof structuredClone === 'function') {
      // structuredClone 比 JSON serialization 更快且保留更多类型
      const cloned = structuredClone(snap);
      const next = history.slice(0, pointer + 1);
      next.push(cloned);
      if (next.length > 100) next.shift();
      set({ history: next, pointer: next.length - 1 });
    } else {
      const fallback = JSON.parse(JSON.stringify(snap));
      const next = history.slice(0, pointer + 1);
      next.push(fallback);
      if (next.length > 100) next.shift();
      set({ history: next, pointer: next.length - 1 });
    }
  },
  undo: () => {
    const { history, pointer } = get();
    if (pointer <= 0) return;
    const target = history[pointer - 1];
    set({ nodes: target.nodes, edges: target.edges, viewport: target.viewport, pointer: pointer - 1 });
  },
  redo: () => {
    const { history, pointer } = get();
    if (pointer >= history.length - 1) return;
    const target = history[pointer + 1];
    set({ nodes: target.nodes, edges: target.edges, viewport: target.viewport, pointer: pointer + 1 });
  },

  clipboard: null,
  setClipboard: (clipboard) => set({ clipboard }),

  deleteNode: (nodeId) => {
    const { nodes, edges } = get();
    set({
      nodes: nodes.filter((n) => n.id !== nodeId),
      edges: edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
    });
  },
  duplicateNode: (nodeId) => {
    const { nodes } = get();
    const src = nodes.find((n) => n.id === nodeId);
    if (!src) return;
    const newId = `n_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const dup: Node = {
      ...JSON.parse(JSON.stringify(src)),
      id: newId,
      position: { x: src.position.x + 40, y: src.position.y + 40 },
    };
    set({ nodes: [...nodes, dup] });
  },

  updateNodeData: (nodeId, patch) =>
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === nodeId ? { ...n, data: { ...(n.data as Record<string, unknown>), ...patch } } : n,
      ),
    })),
}));
