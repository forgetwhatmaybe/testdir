import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { Input, App as AntApp, Dropdown } from 'antd';
import NodeShell from './shared/NodeShell';
import { useFlowStore } from '../../../store/flowStore';
import { useProjectStore } from '../../../store/projectStore';
import { useTaskStore } from '../../../store/taskStore';
import { rawUrl, thumbnailUrl, openFolder, openWithSystem } from '../../../api/files';
import { runTasks } from '../../../api/tasks';

type Data = {
  name?: string;
  result_path?: string | null;
  thumbnail_path?: string | null;
  media_type?: 'image' | 'video' | 'auto';
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

const OutputNode = memo(function OutputNode({ id, data, selected }: NodeProps<Data>) {
  const { message } = AntApp.useApp();
  const nodes = useFlowStore((s) => s.nodes);
  const edges = useFlowStore((s) => s.edges);
  const setNodes = useFlowStore((s) => s.setNodes);
  const project = useProjectStore((s) => s.current);
  const tasks = useTaskStore((s) => s.tasks);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  const update = (patch: Partial<Data>) =>
    setNodes(nodes.map((n) => (n.id === id ? { ...n, data: { ...(n.data as object), ...patch } } : n)));

  const liveTask = useMemo(
    () => Object.values(tasks).find((t) => t.output_node_id === id),
    [tasks, id],
  );
  // 任务完成时回填 result_path 到 data（用于持久化）
  useEffect(() => {
    if (liveTask?.status === 'done' && liveTask.result_path && liveTask.result_path !== data.result_path) {
      const cur = useFlowStore.getState().nodes;
      useFlowStore.setState({
        nodes: cur.map((n) => n.id === id
          ? { ...n, data: { ...(n.data as object), result_path: liveTask.result_path, thumbnail_path: liveTask.thumbnail_path } }
          : n),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveTask?.status, liveTask?.result_path]);

  const resultPath = liveTask?.result_path || data.result_path;
  const mediaType = pickMediaType(resultPath);
  const isVideo = mediaType === 'video';
  const isImage = mediaType === 'image';

  const fileName = (resultPath || '').replace(/\\/g, '/').split('/').pop() || '';
  const projectPathFromName = project ? `${project}/${fileName}` : '';

  const thumbSrc = (() => {
    if (!project || !fileName) return null;
    if (isVideo) return thumbnailUrl(project, fileName);
    if (isImage) return rawUrl(project, fileName);
    return null;
  })();

  const onRun = async () => {
    if (!project) return;
    try {
      await runTasks(project, { version: 2, viewport: { x: 0, y: 0, zoom: 1 }, nodes, edges }, [id]);
      message.success('已加入任务队列');
    } catch (e: any) { message.error(e.message); }
  };

  const onCopyPath = async () => {
    if (!resultPath) return;
    const prefix = isImage ? 'TAPNOW_IMG:' : 'TAPNOW_VID:';
    await navigator.clipboard.writeText(`${prefix}${resultPath}`);
    message.success('已复制路径（带 TAPNOW 前缀，可在画布粘贴生成节点）');
  };

  const items = [
    { key: 'run', label: '▶ 执行当前节点' },
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

  return (
    <NodeShell type="output" selected={selected} title="视频/图片输出" color={statusColor} variant="output" outputId={id} nodeId={id}>
      <Dropdown trigger={['contextMenu']} menu={{
        items, onClick: async (e) => {
          if (e.key === 'run' || e.key === 'run_all') onRun();
          else if (e.key === 'copy_path') onCopyPath();
          else if (e.key === 'folder' && resultPath) await openFolder(projectPathFromName);
        }
      }}>
        <div>
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
        </div>
      </Dropdown>

      <Handle type="target" position={Position.Left} id="in" className="handle-image" />
      <Handle type="source" position={Position.Right} id="out" className="handle-image" />
    </NodeShell>
  );
});

export default OutputNode;
