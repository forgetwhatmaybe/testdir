import { useEffect, useState } from 'react';
import { Button, Modal, Form, Input, Select, App as AntApp, Empty, Dropdown } from 'antd';
import { PlusOutlined, SettingOutlined, FolderOpenOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { listProjects, createProject, deleteProject, type ProjectInfo } from '../api/projects';
import { openFolder } from '../api/files';
import { getGeneral } from '../api/settings';

export default function ProjectListPage() {
  const nav = useNavigate();
  const { message } = AntApp.useApp();
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [disks, setDisks] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm<{ disk: string; name: string }>();

  const load = async () => {
    try {
      const res = await listProjects();
      setProjects(res.data);
      setDisks(res.disks);
      const g = await getGeneral();
      if (g.default_disk && res.disks.includes(g.default_disk)) {
        form.setFieldsValue({ disk: g.default_disk });
      } else {
        form.setFieldsValue({ disk: res.disks[0] });
      }
    } catch (e: any) {
      message.error(e.message);
    }
  };

  useEffect(() => { load(); }, []);

  const onCreate = async () => {
    const v = await form.validateFields();
    try {
      await createProject(v.disk, v.name.trim());
      setOpen(false);
      form.resetFields();
      load();
    } catch (e: any) {
      message.error(e.message);
    }
  };

  const onOpenAIVIDEO = async () => {
    if (!disks.length) return;
    await openFolder(`${disks[0]}:/AIVIDEO`);
  };

  return (
    <main className="project-index-page">
      <div className="project-index-shell">
        <section className="project-index-hero">
          <header className="project-index-header">
            <div className="project-index-copy">
              <p className="project-index-eyebrow">Dark Studio Index</p>
              <h1 className="project-index-title">BU 蓝昊 · pic_video_0515</h1>
              <p className="project-index-description">继续上次的工作流，或创建新项目进入深色工作室界面。</p>
            </div>

            <div className="project-index-actions">
              <Button icon={<PlusOutlined />} type="primary" onClick={() => setOpen(true)}>新建项目</Button>
              <Button icon={<FolderOpenOutlined />} onClick={onOpenAIVIDEO}>打开 AIVIDEO</Button>
              <Button icon={<SettingOutlined />} onClick={() => nav('/settings')}>API 设置</Button>
            </div>
          </header>

          <div className="project-index-summary">
            <div className="project-index-stat">
              <span className="project-index-stat__value">{projects.length}</span>
              <span className="project-index-stat__label">已收录项目</span>
            </div>

            <div className="project-index-summary__details">
              <p>项目卡片会保留当前磁盘路径信息，右键可继续打开目录或从索引中移除。</p>
              <p>当前页只调整视觉层级，不改动项目加载、打开、删除和弹窗行为。</p>
            </div>
          </div>
        </section>

        <section className="project-index-content" aria-label="项目索引">
          {projects.length === 0 ? (
            <div className="project-index-empty">
              <div className="project-index-empty__shell">
                <Empty description="暂无项目" />
                <p className="project-index-empty__hint">先创建一个项目，或直接打开 AIVIDEO 目录查看现有素材与工程。</p>
              </div>
            </div>
          ) : (
            <div className="proj-list project-index-grid">
              {projects.map((p) => (
                <Dropdown
                  key={p.path}
                  trigger={['contextMenu']}
                  menu={{
                    items: [
                      { key: 'open', label: '🚪 打开项目' },
                      { key: 'folder', label: '📁 打开文件夹' },
                      { key: 'del', label: '🗑 从列表移除', danger: true },
                    ],
                    onClick: async (i) => {
                      if (i.key === 'open') nav(`/editor/${encodeURIComponent(p.name)}`);
                      else if (i.key === 'folder') await openFolder(p.path);
                      else if (i.key === 'del') {
                        Modal.confirm({
                          title: '从列表移除？',
                          content: `项目: ${p.name}（不会删除磁盘文件）`,
                          onOk: async () => {
                            await deleteProject(p.name);
                            load();
                          },
                        });
                      }
                    },
                  }}
                >
                  <article className="proj-card" onClick={() => nav(`/editor/${encodeURIComponent(p.name)}`)}>
                    <div className="proj-card__eyebrow">Project Entry</div>
                    <div className="name">{p.name}</div>
                    <div className="proj-card__hint">点击进入编辑器，右键查看更多操作</div>
                    <div className="proj-card__path-shell">
                      <div className="proj-card__path-label">Path</div>
                      <div className="path">{p.path}</div>
                    </div>
                  </article>
                </Dropdown>
              ))}
            </div>
          )}
        </section>
      </div>

      <Modal title="新建项目" open={open} onOk={onCreate} onCancel={() => setOpen(false)} okText="创建" cancelText="取消" destroyOnClose>
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item label="所在磁盘" name="disk" rules={[{ required: true }]}>
            <Select options={disks.map((d) => ({ value: d, label: `${d}:` }))} />
          </Form.Item>
          <Form.Item label="项目名称" name="name" rules={[{ required: true }, { pattern: /^[^\\/:*?"<>|]+$/, message: '不能包含 \\ / : * ? " < > |' }]}>
            <Input placeholder="例如 my_project" />
          </Form.Item>
        </Form>
      </Modal>
    </main>
  );
}
