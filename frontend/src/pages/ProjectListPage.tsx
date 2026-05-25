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
    <div style={{ height: '100vh', overflow: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #2a2a2a', gap: 8 }}>
        <strong style={{ flex: 1, color: '#fff' }}>BU 蓝昊 · pic_video_0515</strong>
        <Button icon={<PlusOutlined />} type="primary" onClick={() => setOpen(true)}>新建项目</Button>
        <Button icon={<FolderOpenOutlined />} onClick={onOpenAIVIDEO}>打开 AIVIDEO</Button>
        <Button icon={<SettingOutlined />} onClick={() => nav('/settings')}>API 设置</Button>
      </div>

      {projects.length === 0 ? (
        <Empty description="暂无项目" style={{ marginTop: 80 }} />
      ) : (
        <div className="proj-list">
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
              <div className="proj-card" onClick={() => nav(`/editor/${encodeURIComponent(p.name)}`)}>
                <div className="name">{p.name}</div>
                <div className="path">{p.path}</div>
              </div>
            </Dropdown>
          ))}
        </div>
      )}

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
    </div>
  );
}
