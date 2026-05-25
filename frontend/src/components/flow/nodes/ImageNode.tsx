import { memo, useState } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { Button, Upload, App as AntApp, Dropdown } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import NodeShell from './shared/NodeShell';
import { useFlowStore } from '../../../store/flowStore';
import { useProjectStore } from '../../../store/projectStore';
import { uploadFile, rawUrl, openFolder, saveMask } from '../../../api/files';
import MaskEditor from '../../dialogs/MaskEditor';

type Data = {
  image_path?: string;
  mask_path?: string | null;
  has_mask_output?: boolean;
};

const ImageNode = memo(function ImageNode({ id, data, selected }: NodeProps<Data>) {
  const { message } = AntApp.useApp();
  const project = useProjectStore((s) => s.current);
  const updateNodeData = useFlowStore((s) => s.updateNodeData);
  const nodes = useFlowStore((s) => s.nodes);
  const pushHistory = useFlowStore((s) => s.pushHistory);
  const [maskOpen, setMaskOpen] = useState(false);

  const updateData = (patch: Partial<Data>) => {
    updateNodeData(id, patch as Record<string, unknown>);
    pushHistory();
  };

  const onUpload = async (file: File) => {
    if (!project) { message.error('未指定项目'); return false; }
    try {
      const r = await uploadFile(project, file);
      updateData({ image_path: r.rel_path });
    } catch (e: any) { message.error(e.message); }
    return false;
  };

  const onCopyImage = async () => {
    if (!project || !data.image_path) return;
    try {
      const resp = await fetch(rawUrl(project, data.image_path));
      const blob = await resp.blob();
      // ClipboardItem 仅 Chromium 支持
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const win = window as any;
      if (win.ClipboardItem && navigator.clipboard?.write) {
        await navigator.clipboard.write([new win.ClipboardItem({ [blob.type || 'image/png']: blob })]);
        message.success('图片已复制到剪贴板');
      } else {
        message.warning('当前浏览器不支持复制图片');
      }
    } catch (e: any) {
      message.error(e.message || '复制失败');
    }
  };

  const onConfirmMask = async (pngBase64: string) => {
    if (!project || !data.image_path) return;
    try {
      const r = await saveMask(project, data.image_path.split('/').pop() || 'mask', pngBase64);
      updateData({ mask_path: r.rel_path, has_mask_output: true });
      message.success('蒙版已保存');
      setMaskOpen(false);
    } catch (e: any) { message.error(e.message); }
  };

  const items = [
    ...(data.image_path ? [
      { key: 'folder', label: '📁 打开所在文件夹' },
      { key: 'copy', label: '📋 复制图片' },
      { key: 'mask', label: data.mask_path ? '🎨 重新绘制蒙版' : '🎨 绘制蒙版' },
    ] : []),
  ];

  return (
    <NodeShell type="image" selected={selected} title="图片上传" color="#4caf50" variant="image" nodeId={id}>
      <Dropdown trigger={['contextMenu']} menu={{
        items,
        onClick: async (e) => {
          if (e.key === 'folder' && project && data.image_path) {
            // 后端期望 path 是绝对路径；用 rel_path 拼是不行的
            // 这里把 raw url 转 abs 由后端解析：用相对路径走 open-folder（后端兼容相对项目根）
            // 简化方案：让 open-folder 接受相对路径并由项目根解析
            await openFolder(`${project}/${data.image_path}`);
          } else if (e.key === 'copy') {
            await onCopyImage();
          } else if (e.key === 'mask') {
            setMaskOpen(true);
          }
        },
      }}>
        <div>
          {data.image_path && project ? (
            <img src={rawUrl(project, data.image_path)} loading="lazy" className="node-thumb" alt="image" />
          ) : (
            <div style={{ height: 80, display: 'grid', placeItems: 'center', color: '#777', border: '1px dashed #444', borderRadius: 4 }}>
              点击下方按钮上传
            </div>
          )}
          <Upload showUploadList={false} beforeUpload={onUpload} accept="image/*">
            <Button size="small" block icon={<UploadOutlined />}>选择图片</Button>
          </Upload>
        </div>
      </Dropdown>

      <Handle type="source" position={Position.Right} id="out" className="handle-image" style={{ top: 30 }} />
      {data.has_mask_output && (
        <Handle type="source" position={Position.Right} id="mask" className="handle-mask" style={{ top: 60 }} />
      )}

      {maskOpen && data.image_path && project && (
        <MaskEditor
          open={maskOpen}
          imageUrl={rawUrl(project, data.image_path)}
          existingMaskUrl={data.mask_path ? rawUrl(project, data.mask_path) : ''}
          onCancel={() => setMaskOpen(false)}
          onConfirm={onConfirmMask}
        />
      )}
    </NodeShell>
  );
});

export default ImageNode;
