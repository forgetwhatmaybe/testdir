import { create } from 'zustand';
import type { TaskInfo } from '../api/tasks';

/** 单个节点的执行状态 */
export interface NodeStatus {
  status: 'idle' | 'queued' | 'executing' | 'success' | 'error' | 'cancelled';
  progress: number;   // 0-100
  message?: string;
  error?: string;
  startTime?: number;
  endTime?: number;
}

type TaskState = {
  tasks: Record<string, TaskInfo>;

  /** 节点级状态追踪：node_id → NodeStatus */
  nodeStatuses: Record<string, NodeStatus>;
  /** 当前活跃的任务 ID（用于关联节点状态） */
  activeTaskId: string | null;
  /** 拓扑排序后的执行子图顺序 */
  subgraphOrder: string[];

  upsert(t: TaskInfo): void;
  remove(id: string): void;
  clearFinished(): void;

  /** 节点状态操作 */
  setNodeStatuses(statuses: Record<string, NodeStatus>): void;
  updateNodeStatus(nodeId: string, patch: Partial<NodeStatus>): void;
  setActiveTask(taskId: string | null, order?: string[]): void;
  resetNodeStatuses(): void;
};

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: {},

  nodeStatuses: {},
  activeTaskId: null,
  subgraphOrder: [],

  upsert: (t) => set({ tasks: { ...get().tasks, [t.id]: t } }),
  remove: (id) => {
    const next = { ...get().tasks };
    delete next[id];
    set({ tasks: next });
  },
  clearFinished: () => {
    const next: Record<string, TaskInfo> = {};
    for (const [k, v] of Object.entries(get().tasks)) {
      if (!['done', 'failed', 'cancelled'].includes(v.status)) next[k] = v;
    }
    set({ tasks: next });
  },

  setNodeStatuses: (statuses) => set({ nodeStatuses: statuses }),
  updateNodeStatus: (nodeId, patch) => {
    const current = get().nodeStatuses;
    const existing = current[nodeId] || { status: 'idle' as const, progress: 0 };
    set({
      nodeStatuses: { ...current, [nodeId]: { ...existing, ...patch } },
    });
  },
  setActiveTask: (taskId, order) => set({
    activeTaskId: taskId,
    subgraphOrder: order || (taskId ? get().subgraphOrder : []),
    ...(taskId === null ? { nodeStatuses: {} } : {}),
  }),
  resetNodeStatuses: () => set({ nodeStatuses: {}, activeTaskId: null, subgraphOrder: [] }),
}));