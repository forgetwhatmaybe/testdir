import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { Input, App as AntApp, Dropdown, Select } from 'antd';
import NodeShell from './shared/NodeShell';
import { useFlowStore } from '../../../store/flowStore';
import { useProjectStore } from '../../../store/projectStore';
import { useTaskStore } from '../../../store/taskStore';
import { rawUrl, thumbnailUrl, openFolder, openWithSystem } from '../../../api/files';
import type { TaskInfo } from '../../../api/tasks';
import { clampOutputBatchCount, runWorkflowTargets } from '../../../utils/nodeExecution';

type OutputResultItem = {
  path: string;
  thumbnail_path?: string | null;
  batch_index?: number | null;
  batch_total?: number | null;
};

type Data = {
  name?: string;
  result_path?: string | null;
  thumbnail_path?: string | null;
  media_type?: 'image' | 'video' | 'auto';
  batch_count?: number;
  result_items?: OutputResultItem[];
};

const VIDEO_EXTS = ['.mp4', '.mov', '.avi', '.mkv', '.wmv', '.flv', '.webm'];
const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.gif'];

function pickMediaType(p?: string | null): 'image' | 'video' | null {
  if (!p) return null;
  const ext = p.toLowerCase().split('?')[0].split('.').pop();
  if (!ext) return null;
  if (VIDEO_EXTS.includes('.' + ext)) return 'video';
  if (IMAGE_EXTS.includes('.' + ext)) return 'image';
  return null;
}

function fileNameFromPath(path?: string | null): string {
  return (path || '').replace(/\\/g, '/').split('/').pop() || '';
}

function normalizeResultItem(item: unknown): OutputResultItem | null {
  if (!item || typeof item !== 'object') return null;
  const candidate = item as Record<string, unknown>;
  const path = typeof candidate.path === 'string' ? candidate.path : null;
  if (!path) return null;
  return {
    path,
    thumbnail_path: typeof candidate.thumbnail_path === 'string' ? candidate.thumbnail_path : null,
    batch_index: typeof candidate.batch_index === 'number' ? candidate.batch_index : null,
    batch_total: typeof candidate.batch_total === 'number' ? candidate.batch_total : null,
  };
}

function mergeResultItems(data: Data, tasks: TaskInfo[]): OutputResultItem[] {
  const merged = new Map<string, OutputResultItem>();
  const addItem = (item: OutputResultItem | null) => {
    if (!item?.path) return;
    const existing = merged.get(item.path) || { path: item.path };
    merged.set(item.path, { ...existing, ...item });
  };

  (data.result_items || []).forEach((item) => addItem(normalizeResultItem(item)));
  if (data.result_path) {
    addItem({ path: data.result_path, thumbnail_path: data.thumbnail_path || null });
  }

  tasks
    .filter((task) => task.status === 'done' && task.result_path)
    .sort((left, right) => (left.batch_index ?? 0) - (right.batch_index ?? 0))
    .forEach((task) => {
      addItem({
        path: task.result_path!,
        thumbnail_path: task.thumbnail_path || null,
        batch_index: task.batch_index ?? null,
        batch_total: task.batch_total ?? null,
      });
    });

  return Array.from(merged.values());
}

const OutputNode = memo(function OutputNode({ id, data, selected }: NodeProps<Data>) {
  const { message } = AntApp.useApp();
  const updateNodeData = useFlowStore((s) => s.updateNodeData);
  const project = useProjectStore((s) => s.current);
  const tasks = useTaskStore((s) => s.tasks);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const update = (patch: Partial<Data>) => updateNodeData(id, patch as Record<string, unknown>);
  const updateShared = (patch: Partial<Data>) => updateNodeData(id, patch as Record<string, unknown>, { syncSelectedType: true });

  const matchingTasks = useMemo(
    () => Object.values(tasks).filter((task) => task.output_node_id === id),
    [tasks, id],
  );
  const liveTask = useMemo(
    () => matchingTasks.find((task) => ['queued', 'running'].includes(task.status))
      || matchingTasks.find((task) => task.status === 'failed')
      || matchingTasks[matchingTasks.length - 1],
    [matchingTasks],
  );
  const resultItems = useMemo(() => mergeResultItems(data, matchingTasks), [data, matchingTasks]);

  useEffect(() => {
    if (!resultItems.length) return;
    const latest = resultItems[resultItems.length - 1];
    const currentItemsKey = JSON.stringify((data.result_items || []).map((item) => normalizeResultItem(item)));
    const nextItemsKey = JSON.stringify(resultItems);
    if (currentItemsKey === nextItemsKey
      && (data.result_path || null) === latest.path
      && (data.thumbnail_path || null) === (latest.thumbnail_path || null)) {
      return;
    }
    update({
      result_items: resultItems,
      result_path: latest.path,
      thumbnail_path: latest.thumbnail_path || null,
    });
  }, [data.result_items, data.result_path, data.thumbnail_path, resultItems]);

  useEffect(() => {
    setActiveIndex(resultItems.length ? resultItems.length - 1 : 0);
  }, [resultItems.length]);

  const currentResult = resultItems[activeIndex] || resultItems[resultItems.length - 1] || null;
  const resultPath = currentResult?.path || liveTask?.result_path || data.result_path;
  const mediaType = pickMediaType(resultPath);
  const isVideo = mediaType === 'video';
  const isImage = mediaType === 'image';

  const fileName = fileNameFromPath(resultPath);
  const projectPathFromName = project ? `${project}/${fileName}` : '';
  const batchCount = clampOutputBatchCount(data.batch_count);

  const thumbSrc = (() => {
    if (!project || !fileName) return null;
    if (isVideo) return thumbnailUrl(project, fileName);
    if (isImage) return rawUrl(project, fileName);
    return null;
  })();

  const onRun = async () => {
    if (!project) return;
    try {
      const snapshot = useFlowStore.getState();
      const { targetCount, taskCount } = await runWorkflowTargets(project, snapshot, {
        clickedNodeId: id,
        mode: 'clicked-or-selected',
      });
      if (!targetCount) {
        message.warning('画布上没有可执行的输出节点');
        return;
      }
      message.success(`已加入 ${taskCount} 个任务${targetCount > 1 ? `（${targetCount} 个输出节点）` : ''}`);
    } catch (e: any) { message.error(e.message); }
  };

  const onRunAll = async () => {
    if (!project) return;
    try {
      const snapshot = useFlowStore.getState();
      const { targetCount, taskCount } = await runWorkflowTargets(project, snapshot, { mode: 'all' });
      if (!targetCount) {
        message.warning('画布上没有可执行的输出节点');
        return;
      }
      message.success(`已加入 ${taskCount} 个任务${targetCount > 1 ? `（${targetCount} 个输出节点）` : ''}`);
    } catch (e: any) { message.error(e.message); }
  };

  const onCopyPath = async () => {
    if (!resultPath) return;
    const prefix = isImage ? 'TAPNOW_IMG:' : 'TAPNOW_VID:';
    await navigator.clipboard.writeText(`${prefix}${resultPath}`);
    message.success('已复制路径（带 TAPNOW 前缀，可在画布粘贴生成节点）');
  };

  const items = [
    { key: 'run', label: '▶ 执行当前节点（多选时执行全部选中）' },
    { key: 'run_all', label: '▶ 执行工作流' },
    ...(resultPath ? [
      { key: 'copy_path', label: '📋 复制输出文件路径' },
      { key: 'folder', label: '📁 打开文件所在文件夹' },
    ] : []),
  ];

  const togglePlay = () => {
    if (!isVideo) {
      // 图片：用系统查看器
      if (resultPath) openWithSystem(projectPathFromName);
      return;
    }
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play(); setPlaying(true); }
    else { v.pause(); setPlaying(false); }
  };
  const onDblClick = () => {
    if (resultPath) openWithSystem(projectPathFromName);
  };
  const onDragStart = (e: React.DragEvent) => {
    if (!project || !fileName || !mediaType) return;
    const url = window.location.origin + rawUrl(project, fileName);
    const mime = isVideo ? 'video/mp4' : 'image/png';
    e.dataTransfer.setData('DownloadURL', `${mime}:${fileName}:${url}`);
    e.dataTransfer.setData('text/uri-list', url);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const statusColor = liveTask?.status === 'failed' ? '#f44336'
    : liveTask?.status === 'running' ? '#1976d2'
    : liveTask?.status === 'done' ? '#388e3c'
    : '#90a4ae';

  const resultThumb = (item: OutputResultItem) => {
    if (!project) return null;
    const itemFileName = fileNameFromPath(item.path);
    if (!itemFileName) return null;
    const itemType = pickMediaType(item.path);
    if (itemType === 'video') return thumbnailUrl(project, itemFileName);
    if (itemType === 'image') return rawUrl(project, itemFileName);
    return null;
  };

  return (
    <NodeShell type="output" selected={selected} title="视频/图片输出" color={statusColor} variant="output" outputId={id} nodeId={id}>
      <Dropdown trigger={['contextMenu']} menu={{
        items, onClick: async (e) => {
          if (e.key === 'run') onRun();
          else if (e.key === 'run_all') onRunAll();
          else if (e.key === 'copy_path') onCopyPath();
          else if (e.key === 'folder' && resultPath) await openFolder(projectPathFromName);
        }
      }}>
        <div>
          <div className="node-row">
            <span className="node-label" style={{ width: 62 }}>批量输出</span>
            <Select
              size="small"
              value={batchCount}
              style={{ flex: 1 }}
              options={Array.from({ length: 10 }, (_, index) => ({ value: index + 1, label: `${index + 1} 个` }))}
              onChange={(value) => updateShared({ batch_count: value })}
            />
          </div>
          <Input size="small" placeholder="输出名称"
            value={data.name || ''} onChange={(e) => update({ name: e.target.value })} />
          <div
            draggable={!!resultPath}
            onDragStart={onDragStart}
            onClick={togglePlay}
            onDoubleClick={onDblClick}
            style={{ position: 'relative', width: 180, height: 100, marginTop: 4, background: '#0d0d0d', borderRadius: 4, overflow: 'hidden', cursor: resultPath ? 'pointer' : 'default' }}
          >
            {isVideo && project && fileName ? (
              <>
                <video
                  ref={videoRef}
                  src={rawUrl(project, fileName)}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: playing ? 'block' : 'none' }}
                  onEnded={() => setPlaying(false)}
                />
                {!playing && thumbSrc && <img src={thumbSrc} loading="lazy" alt="thumb" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                {!playing && (
                  <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#fff', fontSize: 22, textShadow: '0 0 4px #000' }}>▶</div>
                )}
              </>
            ) : isImage && thumbSrc ? (
              <img src={thumbSrc} loading="lazy" alt="result" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', color: '#777', fontSize: 11, textAlign: 'center', padding: 8 }}>
                {liveTask
                  ? (liveTask.status === 'running' ? `执行中 ${liveTask.progress}%` : liveTask.message || liveTask.status)
                  : '右键执行工作流'}
              </div>
            )}
          </div>
          {resultItems.length > 1 && (
            <div className="output-result-strip">
              {resultItems.map((item, index) => {
                const thumb = resultThumb(item);
                const isActive = index === activeIndex;
                return (
                  <button
                    key={`${item.path}-${index}`}
                    type="button"
                    className={`output-result-thumb${isActive ? ' active' : ''}`}
                    onClick={() => setActiveIndex(index)}
                    title={`结果 ${index + 1}`}
                  >
                    {thumb ? <img src={thumb} loading="lazy" alt={`result-${index + 1}`} /> : <span>{index + 1}</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </Dropdown>

      <Handle type="target" position={Position.Left} id="in" className="handle-image" />
      <Handle type="source" position={Position.Right} id="out" className="handle-image" />
    </NodeShell>
  );
});

export default OutputNode;
