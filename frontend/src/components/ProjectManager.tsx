import { useEffect, useState } from 'react';
import { Modal, Input, Button, Space, App as AntApp, Card, Popconfirm } from 'antd';
import { PlusOutlined, DeleteOutlined, FolderOpenOutlined, FolderOutlined, HddOutlined } from '@ant-design/icons';
import { listProjects, createProject, deleteProject, type ProjectInfo } from '../api/projects';
import { useProjectStore } from '../store/projectStore';
import { useNavigate } from 'react-router-dom';
import './ProjectManager.css';

export default function ProjectManager() {
  const { message } = AntApp.useApp();
  const nav = useNavigate();
  const setCurrent = useProjectStore((s) => s.setCurrent);
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [disks, setDisks] = useState<string[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [selDisk, setSelDisk] = useState('');
  const [flipped, setFlipped] = useState<Record<string, boolean>>({});

  const refresh = async () => {
    try {
      const r = await listProjects();
      setProjects(r.data);
      setDisks(r.disks);
      if (!selDisk && r.disks.length > 0) setSelDisk(r.disks[0]);
    } catch (e: any) { message.error(e.message); }
  };

  useEffect(() => { refresh(); }, []);

  const onCreate = async () => {
    if (!newName.trim()) { message.warning('请输入项目名'); return; }
    try {
      await createProject(selDisk, newName.trim());
      setShowCreate(false);
      setNewName('');
      refresh();
      message.success('项目已创建');
    } catch (e: any) { message.error(e.message); }
  };

  const onDelete = async (name: string) => {
    try {
      await deleteProject(name);
      refresh();
      message.success('已删除');
    } catch (e: any) { message.error(e.message); }
  };

  const onOpen = (name: string) => {
    setCurrent(name);
    nav(`/editor/${encodeURIComponent(name)}`);
  };

  return (
    <div className="pm-shell">
      <div className="pm-header">
        <h1 className="pm-title">
          <span className="pm-title-glow">AI Video Studio</span>
          <span className="pm-subtitle">项目中心</span>
        </h1>
        <Button
          className="neon-btn neon-btn-primary"
          icon={<PlusOutlined />}
          onClick={() => setShowCreate(true)}
        >
          新建项目
        </Button>
      </div>

      <div className="pm-grid">
        {projects.map((p) => (
          <div
            key={p.name}
            className={`pm-card ${flipped[p.name] ? 'flipped' : ''}`}
            onMouseEnter={() => setFlipped((s) => ({ ...s, [p.name]: true }))}
            onMouseLeave={() => setFlipped((s) => ({ ...s, [p.name]: false }))}
          >
            <div className="pm-card-inner">
              {/* 正面 */}
              <div className="pm-card-front">
                <div className="pm-card-hologram" />
                <div className="pm-card-scan" />
                <FolderOutlined className="pm-card-icon" />
                <div className="pm-card-name">{p.name}</div>
                <div className="pm-card-disk">
                  <HddOutlined style={{ marginRight: 4 }} />
                  {p.disk}
                </div>
                <div className="pm-card-path" title={p.path}>{p.path}</div>
                <Button
                  className="pm-card-open-btn"
                  icon={<FolderOpenOutlined />}
                  onClick={(e) => { e.stopPropagation(); onOpen(p.name); }}
                >
                  打开
                </Button>
              </div>

              {/* 背面 */}
              <div className="pm-card-back">
                <div className="pm-card-hologram" />
                <div className="pm-card-scan" />
                <div className="pm-card-name-back">{p.name}</div>
                <div style={{ color: '#aaa', fontSize: 12, marginBottom: 12 }}>
                  {p.disk} · {p.path}
                </div>
                <Space>
                  <Button
                    icon={<FolderOpenOutlined />}
                    onClick={(e) => { e.stopPropagation(); onOpen(p.name); }}
                  >
                    打开编辑器
                  </Button>
                  <Popconfirm title="确认删除此项目？" onConfirm={() => onDelete(p.name)}>
                    <Button danger icon={<DeleteOutlined />}>删除</Button>
                  </Popconfirm>
                </Space>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Modal
        title="新建项目"
        open={showCreate}
        onCancel={() => setShowCreate(false)}
        onOk={onCreate}
        okText="创建"
        cancelText="取消"
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <div>
            <span style={{ marginRight: 8, color: '#ccc' }}>磁盘：</span>
            {disks.map((d) => (
              <Button
                key={d}
                size="small"
                type={selDisk === d ? 'primary' : 'default'}
                onClick={() => setSelDisk(d)}
                style={{ marginRight: 6 }}
              >
                {d}
              </Button>
            ))}
          </div>
          <Input
            placeholder="项目名称"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onPressEnter={onCreate}
          />
        </Space>
      </Modal>
    </div>
  );
}