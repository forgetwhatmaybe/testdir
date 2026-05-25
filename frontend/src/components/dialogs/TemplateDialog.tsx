import { useEffect, useState } from 'react';
import { Modal, List } from 'antd';
import { getTemplates } from '../../api/settings';

type Props = { open: boolean; onClose: () => void; onPick(template: any): void };

export default function TemplateDialog({ open, onClose, onPick }: Props) {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => {
    if (open) getTemplates().then(setItems).catch(() => {});
  }, [open]);
  return (
    <Modal title="工作流模板" open={open} onCancel={onClose} footer={null}>
      <List
        dataSource={items}
        renderItem={(it) => (
          <List.Item style={{ cursor: 'pointer' }} onClick={() => { onPick(it); onClose(); }}>
            <strong>{it.name}</strong>
            <span style={{ color: '#888', marginLeft: 12 }}>{it.nodes.length} 节点 · {it.edges.length} 连线</span>
          </List.Item>
        )}
      />
    </Modal>
  );
}
