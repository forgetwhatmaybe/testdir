import { memo, useRef, useState } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { Button, Upload, App as AntApp, Dropdown } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import NodeShell from './shared/NodeShell';
import { useFlowStore } from '../../../store/flowStore';
import { useProjectStore } from '../../../store/projectStore';
import { uploadFile, thumbnailUrl, rawUrl, openFolder, openWithSystem } from '../../../api/files';

type Data = { video_path?: string };

const VideoNode = memo(function VideoNode({ id, data, selected }: NodeProps<Data>) {
  const { message } = AntApp.useApp();
  const project = useProjectStore((s) => s.current);
  const setNodes = useFlowStore((s) => s.setNodes);
  const nodes = useFlowStore((s) => s.nodes);
  const pushHistory = useFlowStore((s) => s.pushHistory);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  const onUpload = async (file: File) => {
    if (!project) { message.error('未指定项目'); return false; }
    try {
      const r = await uploadFile(project, file);
      setNodes(nodes.map((n) => (n.id === id ? { ...n, data: { ...(n.data as object), video_path: r.rel_path } } : n)));
      pushHistory();
    } catch (e: any) { message.error(e.message); }
    return false;
  };

  const fileName = data.video_path?.split('/').pop() || '';
  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play(); setPlaying(true); }
    else { v.pause(); setPlaying(false); }
  };
  const onDblClick = () => {
    if (project && data.video_path) openWithSystem(`${project}/${data.video_path}`);
  };
  const onDragStart = (e: React.DragEvent) => {
    if (!project || !data.video_path) return;
    const url = window.location.origin + rawUrl(project, data.video_path);
    e.dataTransfer.setData('DownloadURL', `video/mp4:${fileName}:${url}`);
    e.dataTransfer.setData('text/uri-list', url);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const items = data.video_path ? [
    { key: 'open', label: '🎞 用系统播放器打开' },
    { key: 'folder', label: '📁 打开所在文件夹' },
  ] : [];

  return (
    <NodeShell type="video" selected={selected} title="视频上传" color="#2196f3" variant="video" nodeId={id}>
      <Dropdown trigger={['contextMenu']} menu={{
        items, onClick: async (e) => {
          if (!project || !data.video_path) return;
          if (e.key === 'open') await openWithSystem(`${project}/${data.video_path}`);
          else if (e.key === 'folder') await openFolder(`${project}/${data.video_path}`);
        }
      }}>
        <div
          draggable={!!data.video_path}
          onDragStart={onDragStart}
          onClick={togglePlay}
          onDoubleClick={onDblClick}
          style={{ position: 'relative', width: 180, height: 100, margin: '4px auto', cursor: 'pointer', background: '#0d0d0d', borderRadius: 4, overflow: 'hidden' }}
        >
          {data.video_path && project ? (
            <>
              <video
                ref={videoRef}
                src={rawUrl(project, data.video_path)}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: playing ? 'block' : 'none' }}
                onEnded={() => setPlaying(false)}
              />
              {!playing && (
                <img src={thumbnailUrl(project, data.video_path)} loading="lazy" alt="thumb"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              )}
              {!playing && (
                <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#fff', fontSize: 24, textShadow: '0 0 4px #000' }}>▶</div>
              )}
            </>
          ) : (
            <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: '#777' }}>
              点击下方按钮选择视频
            </div>
          )}
        </div>
      </Dropdown>
      <Upload showUploadList={false} beforeUpload={onUpload} accept="video/*">
        <Button size="small" block icon={<UploadOutlined />}>选择视频</Button>
      </Upload>
      <Handle type="source" position={Position.Right} id="out" className="handle-video" />
    </NodeShell>
  );
});

export default VideoNode;
