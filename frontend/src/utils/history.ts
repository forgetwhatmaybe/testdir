/**
 * Command 模式撤销/重做栈
 *
 * 用法：
 *   const history = new HistoryManager<State>(initialState);
 *   history.execute(new MyCommand());  // 执行并推入栈
 *   history.undo();  // 撤销
 *   history.redo();  // 重做
 */

export interface Command<State> {
  /** 正向执行，返回新状态 */
  execute(state: State): State;
  /** 反向撤销，返回旧状态 */
  undo(state: State): State;
  /** 命令描述（用于 UI 提示） */
  label: string;
}

export class HistoryManager<State> {
  private undoStack: Command<State>[] = [];
  private redoStack: Command<State>[] = [];
  private maxSize: number;

  constructor(maxSize = 100) {
    this.maxSize = maxSize;
  }

  /** 执行命令并推入撤销栈，清空重做栈 */
  execute(cmd: Command<State>, state: State): State {
    const newState = cmd.execute(state);
    this.undoStack.push(cmd);
    if (this.undoStack.length > this.maxSize) {
      this.undoStack.shift();
    }
    this.redoStack = [];
    return newState;
  }

  /** 撤销最近一步 */
  undo(state: State): { state: State; label: string } | null {
    const cmd = this.undoStack.pop();
    if (!cmd) return null;
    const prevState = cmd.undo(state);
    this.redoStack.push(cmd);
    return { state: prevState, label: cmd.label };
  }

  /** 重做最近撤销的一步 */
  redo(state: State): { state: State; label: string } | null {
    const cmd = this.redoStack.pop();
    if (!cmd) return null;
    const nextState = cmd.execute(state);
    this.undoStack.push(cmd);
    return { state: nextState, label: cmd.label };
  }

  /** 是否可以撤销 */
  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  /** 是否可以重做 */
  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /** 最近一次操作的描述 */
  get lastLabel(): string {
    return this.undoStack.length > 0
      ? this.undoStack[this.undoStack.length - 1].label
      : '';
  }

  /** 可重做的操作描述 */
  get nextLabel(): string {
    return this.redoStack.length > 0
      ? this.redoStack[this.redoStack.length - 1].label
      : '';
  }

  /** 清空历史 */
  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }
}

// ---- 预置命令 ----

import type { Node, Edge, Viewport } from 'reactflow';

export type FlowState = { nodes: Node[]; edges: Edge[]; viewport: Viewport };

/** 添加节点命令 */
export class AddNodesCommand implements Command<FlowState> {
  label = '添加节点';
  constructor(private addedNodes: Node[]) {}
  execute(state: FlowState): FlowState {
    return { ...state, nodes: [...state.nodes, ...this.addedNodes] };
  }
  undo(state: FlowState): FlowState {
    const ids = new Set(this.addedNodes.map((n) => n.id));
    return { ...state, nodes: state.nodes.filter((n) => !ids.has(n.id)) };
  }
}

/** 删除节点命令 */
export class DeleteNodesCommand implements Command<FlowState> {
  label = '删除节点';
  constructor(private deletedNodes: Node[], private deletedEdges: Edge[]) {}
  execute(state: FlowState): FlowState {
    const ids = new Set(this.deletedNodes.map((n) => n.id));
    return {
      ...state,
      nodes: state.nodes.filter((n) => !ids.has(n.id)),
      edges: state.edges.filter(
        (e) => !ids.has(e.source) && !ids.has(e.target)
      ),
    };
  }
  undo(state: FlowState): FlowState {
    return {
      ...state,
      nodes: [...state.nodes, ...this.deletedNodes],
      edges: [...state.edges, ...this.deletedEdges],
    };
  }
}

/** 移动节点命令 */
export class MoveNodesCommand implements Command<FlowState> {
  label = '移动节点';
  constructor(
    private nodeIds: string[],
    private oldPositions: Record<string, { x: number; y: number }>,
    private newPositions: Record<string, { x: number; y: number }>
  ) {}
  execute(state: FlowState): FlowState {
    return {
      ...state,
      nodes: state.nodes.map((n) =>
        this.nodeIds.includes(n.id) && this.newPositions[n.id]
          ? { ...n, position: this.newPositions[n.id] }
          : n
      ),
    };
  }
  undo(state: FlowState): FlowState {
    return {
      ...state,
      nodes: state.nodes.map((n) =>
        this.nodeIds.includes(n.id) && this.oldPositions[n.id]
          ? { ...n, position: this.oldPositions[n.id] }
          : n
      ),
    };
  }
}

/** 修改节点数据命令 */
export class UpdateNodeDataCommand implements Command<FlowState> {
  label = '修改参数';
  constructor(
    private nodeId: string,
    private oldData: Record<string, any>,
    private newData: Record<string, any>
  ) {}
  execute(state: FlowState): FlowState {
    return {
      ...state,
      nodes: state.nodes.map((n) =>
        n.id === this.nodeId ? { ...n, data: this.newData } : n
      ),
    };
  }
  undo(state: FlowState): FlowState {
    return {
      ...state,
      nodes: state.nodes.map((n) =>
        n.id === this.nodeId ? { ...n, data: this.oldData } : n
      ),
    };
  }
}

/** 添加连线命令 */
export class AddEdgeCommand implements Command<FlowState> {
  label = '添加连线';
  constructor(private edge: Edge) {}
  execute(state: FlowState): FlowState {
    return { ...state, edges: [...state.edges, this.edge] };
  }
  undo(state: FlowState): FlowState {
    return { ...state, edges: state.edges.filter((e) => e.id !== this.edge.id) };
  }
}

/** 删除连线命令 */
export class DeleteEdgeCommand implements Command<FlowState> {
  label = '删除连线';
  constructor(private edge: Edge) {}
  execute(state: FlowState): FlowState {
    return { ...state, edges: state.edges.filter((e) => e.id !== this.edge.id) };
  }
  undo(state: FlowState): FlowState {
    return { ...state, edges: [...state.edges, this.edge] };
  }
}
