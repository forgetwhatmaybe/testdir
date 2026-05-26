import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { App as AntApp } from 'antd';
import { loadWorkflow, saveWorkflow } from '../api/projects';
import { useFlowStore } from '../store/flowStore';
import { useProjectStore } from '../store/projectStore';
import { useTaskStore, type NodeStatus } from '../store/taskStore';
import { connectTasksWS, type WSMessage } from '../api/ws';
import { listTasks, runTasks } from '../api/tasks';
import { addHistory, type HistoryEntry } from '../api/history';
import Toolbar from '../components/flow/Toolbar';
import NodePanel from '../components/flow/NodePanel';
import HelpPanel from '../components/flow/HelpPanel';
import FlowCanvas from '../components/flow/FlowCanvas';
import StatusBanner from '../components/flow/StatusBanner';
import ParticleBackground from '../components/flow/ParticleBackground';
import TaskQueueDialog from '../components/dialogs/TaskQueueDialog';
import TemplateDialog from '../components/dialogs/TemplateDialog';
import HistoryDialog from '../components/dialogs/HistoryDialog';
import ErrorBoundary from '../components/ErrorBoundary';
import type { TemplateData } from '../components/flow/FlowCanvas';
import { normalizeWorkflowPayload } from '../utils/workflowDefaults';

export default function EditorPage() {
  const { name } = useParams<{ name: string }>();
  const projectName = decodeURIComponent(name || '');
  const { message } = AntApp.useApp();

  useEffect(() => { useProjectStore.setState({ current: projectName }); }, [projectName]);

  const loadSnapshot = useFlowStore((s) => s.loadSnapshot);
  const upsertTask = useTaskStore((s) => s.upsert);
  const setNodeStatuses = useTaskStore((s) => s.setNodeStatuses);
  const updateNodeStatus = useTaskStore((s) => s.updateNodeStatus);
  const setActiveTask = useTaskStore((s) => s.setActiveTask);

  const [queueOpen, setQueueOpen] = useState(false);
  const [tplOpen, setTplOpen] = useState(false);
  const [hisOpen, setHisOpen] = useState(false);
  const [showHelp, setShowHelp] = useState(true);
  const [pendingTpl, setPendingTpl] = useState<TemplateData | null>(null);
  const locateRef = useRef<(id: string) => void>(() => {});
  const writtenHistory = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!projectName) return;
    loadWorkflow(projectName).then((wf) => {
      const normalized = normalizeWorkflowPayload(wf);
      loadSnapshot({
        nodes: (normalized.nodes || []) as any,
        edges: (normalized.edges || []) as any,
        viewport: normalized.viewport || { x: 0, y: 0, zoom: 1 },
      });
    }).catch((e) => message.error(e.message));
  }, [projectName, loadSnapshot, message]);

  useEffect(() => {
    listTasks().then((tasks) => tasks.forEach(upsertTask)).catch(() => {});
    const ws = connectTasksWS((msg: WSMessage) => {
      if (msg.type === 'task_update') {
        upsertTask(msg.task);
        // 终态写历史
        if (
          ['done', 'failed', 'cancelled'].includes(msg.task.status) &&
          !writtenHistory.current.has(msg.task.id)
        ) {
          writtenHistory.current.add(msg.task.id);
          const params = currentNodeParams(msg.task.output_node_id);
          addHistory(projectName, {
            ts: Date.now(),
            output_node_id: msg.task.output_node_id,
            name: msg.task.name,
            kind: msg.task.kind,
            status: msg.task.status as HistoryEntry['status'],
            result_path: msg.task.result_path,
            thumbnail_path: msg.task.thumbnail_path,
            params,
            error: (msg.task as any).error,
          }).catch(() => {});
        }
        // 任务完成/失败时重置节点状态
        if (['done', 'failed', 'cancelled'].includes(msg.task.status)) {
          setActiveTask(null);
        }
      }
      if (msg.type === 'node_status') {
        if (msg.node_statuses) {
          // 批量初始状态
          setNodeStatuses(msg.node_statuses);
          setActiveTask(msg.task_id, msg.subgraph_order);
        } else if (msg.node_id) {
          // 单节点更新
          updateNodeStatus(msg.node_id, {
            status: msg.status as NodeStatus['status'],
            progress: msg.progress ?? 0,
            message: msg.message,
            error: msg.error,
          });
        }
      }
    });
    return () => ws.close();
  }, [upsertTask, projectName]);

  const currentNodeParams = (outId: string) => {
    const { nodes } = useFlowStore.getState();
    const n = nodes.find((x) => x.id === outId);
    return n?.data || null;
  };

  // 自动保存
  const timer = useRef<number | null>(null);
  const nodes = useFlowStore((s) => s.nodes);
  const edges = useFlowStore((s) => s.edges);
  const viewport = useFlowStore((s) => s.viewport);
  useEffect(() => {
    if (!projectName) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      saveWorkflow(projectName, { version: 2, viewport, nodes, edges }).catch(() => {});
    }, 2000) as unknown as number;
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [projectName, nodes, edges, viewport]);

  const saveNow = async () => {
    if (!projectName) return;
    await saveWorkflow(projectName, { version: 2, viewport, nodes, edges });
    message.success('已保存');
  };

  const handleExecuteWorkflow = useCallback(() => {
    const state = useFlowStore.getState();
    const outputNodes = state.nodes.filter(n => n.type === 'output' || n.type === 'text_display');
    if (outputNodes.length === 0) {
      message.warning('请先添加输出节点 (Output / TextDisplay)');
      return;
    }
    const outputIds = outputNodes.map(n => n.id);
    runTasks(projectName, {
      version: 2,
      viewport: state.viewport,
      nodes: state.nodes,
      edges: state.edges,
    }, outputIds).then((res) => {
      message.success(`已提交 ${res.task_ids?.length || 1} 个任务`);
    }).catch((e) => message.error(e.message));
  }, [projectName, message]);

  return (
    <ErrorBoundary fallbackTitle="编辑器渲染异常">
      <ParticleBackground />
      <div className="editor-shell" style={{ gridTemplateColumns: showHelp ? '240px 1fr 240px' : '240px 1fr 0' }} role="main" aria-label="编辑器主区域">
        <Toolbar
          projectName={projectName}
          saveNow={saveNow}
          onOpenQueue={() => setQueueOpen(true)}
          onOpenTemplates={() => setTplOpen(true)}
          onOpenHistory={() => setHisOpen(true)}
          onToggleHelp={() => setShowHelp((v) => !v)}
          showHelp={showHelp}
        />
        <div className="editor-left" role="complementary" aria-label="节点选择面板"><NodePanel /></div>
        <div className="editor-center" role="region" aria-label="画布区域">
          <StatusBanner />
          <FlowCanvas
            saveNow={saveNow}
            pendingTemplate={pendingTpl}
            onTemplatePlaced={() => setPendingTpl(null)}
            registerLocate={(fn) => { locateRef.current = fn; }}
            executeWorkflow={handleExecuteWorkflow}
          />
        </div>
        {showHelp && <div className="editor-right"><HelpPanel /></div>}

        <TaskQueueDialog open={queueOpen} onClose={() => setQueueOpen(false)} onLocate={(id) => { setQueueOpen(false); locateRef.current(id); }} />
        <TemplateDialog open={tplOpen} onClose={() => setTplOpen(false)} onPick={(tpl) => setPendingTpl(tpl)} />
        <HistoryDialog open={hisOpen} onClose={() => setHisOpen(false)} onLoad={(entry) => {
          // 把 entry.params 应用回对应节点
          const all = useFlowStore.getState().nodes;
          const match = all.find((n) => n.id === entry.output_node_id);
          if (match && entry.params) {
            useFlowStore.setState({
              nodes: all.map((n) => n.id === match.id ? { ...n, data: entry.params } : n),
            });
            message.success('已加载历史参数');
          }
          setHisOpen(false);
        }} />
      </div>
    </ErrorBoundary>
  );
}
