import { useEffect, useState } from 'react';
import { Modal, Card, Button, Row, Col, Tag, Empty, App as AntApp } from 'antd';
import { ThunderboltOutlined, PictureOutlined, VideoCameraOutlined, ExperimentOutlined } from '@ant-design/icons';
import { api } from '../api/client';
import './TemplateGallery.css';

type Template = {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  nodes: number;
  tags: string[];
};

const ICON_MAP: Record<string, React.ReactNode> = {
  video: <VideoCameraOutlined style={{ fontSize: 32 }} />,
  image: <PictureOutlined style={{ fontSize: 32 }} />,
  experiment: <ExperimentOutlined style={{ fontSize: 32 }} />,
  default: <ThunderboltOutlined style={{ fontSize: 32 }} />,
};

const CATEGORY_COLORS: Record<string, string> = {
  '文生视频': '#7c3aed',
  '图生视频': '#2563eb',
  '图片编辑': '#ec407a',
  '文本视觉': '#059669',
  '综合': '#f59e0b',
};

interface Props {
  open: boolean;
  onClose: () => void;
  onPick: (tpl: any) => void;
}

export default function TemplateGallery({ open, onClose, onPick }: Props) {
  const { message } = AntApp.useApp();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeCat, setActiveCat] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const r = await api.get('/templates');
      setTemplates(r.data.data || []);
    } catch { /* 离线可用内置模板 */ }
  };

  useEffect(() => { if (open) refresh(); }, [open]);

  const onApply = async () => {
    if (!selectedId) { message.warning('请选择一个模板'); return; }
    setLoading(true);
    try {
      const r = await api.get(`/templates/${selectedId}`);
      onPick(r.data.data);
      onClose();
    } catch (e: any) { message.error(e.message); }
    finally { setLoading(false); }
  };

  const categories = [...new Set(templates.map((t) => t.category))];
  const filtered = activeCat ? templates.filter((t) => t.category === activeCat) : templates;

  return (
    <Modal
      title={<span className="tg-modal-title">工作流模板库</span>}
      open={open}
      onCancel={onClose}
      width={820}
      footer={[
        <Button key="close" onClick={onClose}>取消</Button>,
        <Button key="apply" type="primary" loading={loading} onClick={onApply}>应用模板</Button>,
      ]}
    >
      {/* 分类筛选 */}
      <div className="tg-cats">
        <Tag
          className={`tg-cat-tag ${!activeCat ? 'active' : ''}`}
          onClick={() => setActiveCat(null)}
        >
          全部
        </Tag>
        {categories.map((c) => (
          <Tag
            key={c}
            className={`tg-cat-tag ${activeCat === c ? 'active' : ''}`}
            color={CATEGORY_COLORS[c] || undefined}
            onClick={() => setActiveCat(c)}
          >
            {c}
          </Tag>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Empty description="暂无模板" style={{ padding: 32 }} />
      ) : (
        <Row gutter={[16, 16]} className="tg-grid">
          {filtered.map((tpl) => (
            <Col span={8} key={tpl.id}>
              <div
                className={`tg-card ${selectedId === tpl.id ? 'selected' : ''}`}
                onClick={() => setSelectedId(tpl.id)}
              >
                <div className="tg-card-hologram" />
                <div className="tg-card-icon">
                  {ICON_MAP[tpl.icon] || ICON_MAP.default}
                </div>
                <div className="tg-card-name">{tpl.name}</div>
                <div className="tg-card-desc">{tpl.description}</div>
                <div className="tg-card-meta">
                  <span>{tpl.nodes} 个节点</span>
                  <Tag color={CATEGORY_COLORS[tpl.category]}>{tpl.category}</Tag>
                </div>
                <div className="tg-card-tags">
                  {tpl.tags?.map((tag) => (
                    <Tag key={tag} className="tg-mini-tag">{tag}</Tag>
                  ))}
                </div>
              </div>
            </Col>
          ))}
        </Row>
      )}
    </Modal>
  );
}