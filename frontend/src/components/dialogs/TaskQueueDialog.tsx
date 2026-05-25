import { Modal, Table, Button, Space, Popconfirm, App as AntApp } from 'antd';
import { useTaskStore } from '../../store/taskStore';
import { cancelTask, cancelAll, clearFinished } from '../../api/tasks';

type Props = { open: boolean; onClose: () => void; onLocate(outputId: string): void };

export default function TaskQueueDialog({ open, onClose, onLocate }: Props) {
  const { message } = AntApp.useApp();
  const tasks = useTaskStore((s) => s.tasks);
  const list = Object.values(tasks);

  return (
    <Modal title="任务队列" open={open} onCancel={onClose} footer={null} width={780}>
      <Space style={{ marginBottom: 8 }}>
        <Popconfirm title="全部停止？" onConfirm={async () => { await cancelAll(); message.success('已发起取消'); }}>
          <Button danger>全部停止</Button>
        </Popconfirm>
        <Button onClick={async () => { await clearFinished(); useTaskStore.getState().clearFinished(); }}>
          清除已完成
        </Button>
      </Space>
      <Table
        rowKey="id"
        size="small"
        pagination={false}
        dataSource={list}
        onRow={(r) => ({ onDoubleClick: () => onLocate(r.output_node_id) })}
        columns={[
          { title: '名称', dataIndex: 'name', width: 120 },
          { title: '类型', dataIndex: 'kind', width: 100 },
          { title: '状态', dataIndex: 'status', width: 90 },
          { title: '进度', dataIndex: 'progress', width: 70, render: (v) => `${v}%` },
          { title: '消息', dataIndex: 'message', ellipsis: true },
          {
            title: '操作', width: 80,
            render: (_, r) => (
              ['queued', 'running'].includes(r.status) ? (
                <Button size="small" onClick={async () => { await cancelTask(r.id); }}>停止</Button>
              ) : null
            ),
          },
        ]}
      />
    </Modal>
  );
}
