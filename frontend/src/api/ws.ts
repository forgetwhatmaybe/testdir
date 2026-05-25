/** 任务进度 WebSocket。*/
import type { TaskInfo } from './tasks';
import type { NodeStatus } from '../store/taskStore';

export type WSMessage =
  | { type: 'task_update'; task: TaskInfo }
  | { type: 'task_done'; task_id: string; result_path?: string; thumbnail_path?: string }
  | { type: 'task_failed'; task_id: string; error: string }
  | { type: 'task_log'; task_id: string; line: string }
  | {
      type: 'node_status';
      task_id: string;
      /** 单节点更新 */
      node_id?: string;
      status?: NodeStatus['status'];
      progress?: number;
      message?: string;
      error?: string;
      /** 批量初始节点状态 */
      node_statuses?: Record<string, NodeStatus>;
      subgraph_order?: string[];
    };

export function connectTasksWS(onMessage: (m: WSMessage) => void): WebSocket {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const url = `${proto}//${location.host}/api/ws/tasks`;
  const ws = new WebSocket(url);
  ws.onmessage = (ev) => {
    try {
      onMessage(JSON.parse(ev.data));
    } catch {
      // ignore
    }
  };
  ws.onclose = () => {
    // 自动重连：3 秒后
    setTimeout(() => connectTasksWS(onMessage), 3000);
  };
  return ws;
}