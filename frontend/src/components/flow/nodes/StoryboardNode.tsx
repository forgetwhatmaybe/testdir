import { memo, useState } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { Button, Upload, App as AntApp, Dropdown, Select, InputNumber, Space, ColorPicker, message } from 'antd';
import { UploadOutlined, MergeCellsOutlined, SplitCellsOutlined } from '@ant-design/icons';
import NodeShell from './shared/NodeShell';
import { useFlowStore } from '../../../store/flowStore';
import { useProjectStore } from '../../../store/projectStore';
import { uploadFile, rawUrl, openFolder } from '../../../api/files';
import { api } from '../../../api/client';

type Data = {
  image_paths?: string[];
  combined_path?: string;
  layout?: 'horizontal' | 'vertical' | 'grid';
  rows?: number;
  cols?: number;
  spacing?: number;
  background_color?: string;
  output_format?: 'png' | 'jpg';
};

const StoryboardNode = memo(function StoryboardNode({ id, data, selected }: NodeProps<Data>) {
  const { message: antMessage } = AntApp.useApp();
  const project = useProjectStore((s) => s.current);
  const setNodes = useFlowStore((s) => s.setNodes);
  const nodes = useFlowStore((s) => s.nodes);
  const pushHistory = useFlowStore((s) => s.pushHistory);
  
  const [combineLoading, setCombineLoading] = useState(false);
  const [splitLoading, setSplitLoading] = useState(false);
  const [detectLoading, setDetectLoading] = useState(false);

  const updateData = (patch: Partial<Data>) => {
    setNodes(nodes.map((n) => (n.id === id ? { ...n, data: { ...(n.data as object), ...patch } } : n)));
    pushHistory();
  };

  const onUpload = async (file: File) => {
    if (!project) { antMessage.error('未指定项目'); return false; }
    try {
      const r = await uploadFile(project, file);
      const currentPaths = data.image_paths || [];
      updateData({ image_paths: [...currentPaths, r.rel_path] });
      antMessage.success('图片上传成功');
    } catch (e: any) { antMessage.error(e.message); }
    return false;
  };

  const removeImage = (index: number) => {
    const currentPaths = data.image_paths || [];
    const newPaths = [...currentPaths];
    newPaths.splice(index, 1);
    updateData({ image_paths: newPaths });
  };

  const clearAllImages = () => {
    updateData({ image_paths: [] });
  };

  const combineImages = async () => {
    if (!project) { antMessage.error('未指定项目'); return; }
    const imagePaths = data.image_paths || [];
    if (imagePaths.length < 2) { antMessage.warning('至少需要2张图片进行合成'); return; }

    setCombineLoading(true);
    try {
      const formData = new FormData();
      formData.append('project', project);
      imagePaths.forEach(path => formData.append('image_paths', path));
      formData.append('layout', data.layout || 'grid');
      formData.append('spacing', String(data.spacing || 10));
      formData.append('background_color', data.background_color || '#000000');
      formData.append('output_format', data.output_format || 'png');

      const response = await api.post('/storyboard/combine', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (response.data.ok) {
        const { rel_path, canvas_size, image_count, layout } = response.data.data;
        updateData({ combined_path: rel_path });
        antMessage.success(`成功合成为${image_count}宫格分镜图 (${canvas_size.width}x${canvas_size.height}, ${layout}布局)`);
      } else {
        antMessage.error('合成失败');
      }
    } catch (e: any) {
      antMessage.error(e.message || '合成失败');
    } finally {
      setCombineLoading(false);
    }
  };

  const splitStoryboard = async () => {
    if (!project) { antMessage.error('未指定项目'); return; }
    if (!data.combined_path) { antMessage.warning('请先上传或生成分镜图'); return; }

    setSplitLoading(true);
    try {
      const formData = new FormData();
      formData.append('project', project);
      formData.append('image_path', data.combined_path);
      formData.append('rows', String(data.rows || 1));
      formData.append('cols', String(data.cols || 1));
      formData.append('spacing', String(data.spacing || 0));
      formData.append('output_format', data.output_format || 'png');

      const response = await api.post('/storyboard/split', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (response.data.ok) {
        const { output_paths, total_cells } = response.data.data;
        antMessage.success(`成功拆分为${total_cells}张独立图片`);
        // 可以将拆解后的图片路径保存或显示
        
      } else {
        antMessage.error('拆解失败');
      }
    } catch (e: any) {
      antMessage.error(e.message || '拆解失败');
    } finally {
      setSplitLoading(false);
    }
  };

  const detectGrid = async () => {
    if (!project) { antMessage.error('未指定项目'); return; }
    if (!data.combined_path) { antMessage.warning('请先上传分镜图'); return; }

    setDetectLoading(true);
    try {
      const formData = new FormData();
      formData.append('project', project);
      formData.append('image_path', data.combined_path);
      formData.append('threshold', '0.1');

      const response = await api.post('/storyboard/detect-grid', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (response.data.ok) {
        const { estimated_rows, estimated_cols } = response.data.data;
        updateData({ rows: estimated_rows, cols: estimated_cols });
        antMessage.success(`检测到 ${estimated_rows}行 ${estimated_cols}列 网格布局`);
      } else {
        antMessage.error('网格检测失败');
      }
    } catch (e: any) {
      antMessage.error(e.message || '网格检测失败');
    } finally {
      setDetectLoading(false);
    }
  };

  const items = [
    ...((data.image_paths && data.image_paths.length > 0) ? [
      { key: 'clear', label: '🗑️ 清空所有图片' },
    ] : []),
    ...(data.combined_path ? [
      { key: 'folder', label: '📁 打开所在文件夹' },
      { key: 'detect', label: '🔍 自动检测网格' },
    ] : []),
  ];

  return (
    <NodeShell type="storyboard" selected={selected} title="图片分镜处理" color="#7b1fa2" variant="storyboard" nodeId={id}>
      <Dropdown trigger={['contextMenu']} menu={{
        items,
        onClick: async (e) => {
          if (e.key === 'folder' && project && data.combined_path) {
            await openFolder(`${project}/${data.combined_path}`);
          } else if (e.key === 'clear') {
            clearAllImages();
          } else if (e.key === 'detect') {
            await detectGrid();
          }
        },
      }}>
        <div>
          {/* 图片预览区域 */}
          {data.image_paths && data.image_paths.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: '#9e9e9e', marginBottom: 4 }}>
                已上传 {data.image_paths.length} 张图片
              </div>
              <div style={{ 
                display: 'flex', 
                flexWrap: 'wrap', 
                gap: 4,
                maxHeight: 100,
                overflowY: 'auto',
                padding: 4,
                background: '#111',
                borderRadius: 4
              }}>
                {data.image_paths.map((path, index) => (
                  <div key={index} style={{ position: 'relative' }}>
                    <img 
                      src={project ? rawUrl(project, path) : ''} 
                      loading="lazy"
                      alt={`preview-${index}`}
                      style={{ 
                        width: 40, 
                        height: 40, 
                        objectFit: 'cover',
                        borderRadius: 2,
                        border: '1px solid #333'
                      }}
                    />
                    <Button
                      size="small"
                      type="text"
                      danger
                      style={{
                        position: 'absolute',
                        top: -6,
                        right: -6,
                        width: 16,
                        height: 16,
                        minWidth: 16,
                        padding: 0,
                        fontSize: 10,
                        background: '#f44336',
                        color: 'white',
                        borderRadius: '50%'
                      }}
                      onClick={() => removeImage(index)}
                    >
                      ×
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 分镜图预览 */}
          {data.combined_path && project && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: '#9e9e9e', marginBottom: 4 }}>
                分镜图预览
              </div>
              <img 
                src={rawUrl(project, data.combined_path)} 
                loading="lazy" 
                className="node-thumb" 
                alt="storyboard" 
                style={{ maxHeight: 120 }}
              />
            </div>
          )}

          {/* 上传按钮 */}
          <Upload showUploadList={false} beforeUpload={onUpload} accept="image/*" multiple>
            <Button size="small" block icon={<UploadOutlined />} style={{ marginBottom: 8 }}>
              选择图片（可多选）
            </Button>
          </Upload>

          {/* 配置区域 */}
          <div className="node-row">
            <span className="node-label">布局:</span>
            <Select
              size="small"
              value={data.layout || 'grid'}
              onChange={(value) => updateData({ layout: value })}
              style={{ flex: 1 }}
              options={[
                { value: 'horizontal', label: '水平排列' },
                { value: 'vertical', label: '垂直排列' },
                { value: 'grid', label: '网格排列' },
              ]}
            />
          </div>

          <div className="node-row">
            <span className="node-label">间距:</span>
            <InputNumber
              size="small"
              value={data.spacing || 10}
              onChange={(value) => updateData({ spacing: value || 10 })}
              min={0}
              max={100}
              style={{ flex: 1 }}
            />
          </div>

          <div className="node-row">
            <span className="node-label">背景:</span>
            <ColorPicker
              size="small"
              value={data.background_color || '#000000'}
              onChange={(color) => updateData({ background_color: color.toHexString() })}
              showText
              style={{ flex: 1 }}
            />
          </div>

          <div className="node-row">
            <span className="node-label">格式:</span>
            <Select
              size="small"
              value={data.output_format || 'png'}
              onChange={(value) => updateData({ output_format: value })}
              style={{ flex: 1 }}
              options={[
                { value: 'png', label: 'PNG' },
                { value: 'jpg', label: 'JPG' },
              ]}
            />
          </div>

          {/* 拆解配置（仅当有分镜图时显示） */}
          {data.combined_path && (
            <>
              <div className="node-row">
                <span className="node-label">行数:</span>
                <InputNumber
                  size="small"
                  value={data.rows || 1}
                  onChange={(value) => updateData({ rows: value || 1 })}
                  min={1}
                  max={10}
                  style={{ flex: 1 }}
                />
              </div>

              <div className="node-row">
                <span className="node-label">列数:</span>
                <InputNumber
                  size="small"
                  value={data.cols || 1}
                  onChange={(value) => updateData({ cols: value || 1 })}
                  min={1}
                  max={10}
                  style={{ flex: 1 }}
                />
              </div>
            </>
          )}

          {/* 操作按钮 */}
          <Space direction="vertical" style={{ width: '100%', marginTop: 8 }}>
            <Button
              size="small"
              block
              icon={<MergeCellsOutlined />}
              loading={combineLoading}
              onClick={combineImages}
              disabled={!data.image_paths || data.image_paths.length < 2}
              style={{
                background: 'linear-gradient(135deg, #7b1fa2, #9c27b0)',
                border: 'none',
                color: 'white'
              }}
            >
              合成分镜图
            </Button>

            {data.combined_path && (
              <Button
                size="small"
                block
                icon={<SplitCellsOutlined />}
                loading={splitLoading}
                onClick={splitStoryboard}
                style={{
                  background: 'linear-gradient(135deg, #2196f3, #03a9f4)',
                  border: 'none',
                  color: 'white'
                }}
              >
                拆解分镜图
              </Button>
            )}
          </Space>
        </div>
      </Dropdown>

      <Handle type="source" position={Position.Right} id="out" className="handle-image" style={{ top: 30 }} />
      <Handle type="target" position={Position.Left} id="in" className="handle-image" style={{ top: 30 }} />
    </NodeShell>
  );
});

export default StoryboardNode;