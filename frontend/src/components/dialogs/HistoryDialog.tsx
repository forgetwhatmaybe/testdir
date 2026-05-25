import { useEffect, useMemo, useState } from 'react';
import { Modal, Input, Button, Space, App as AntApp, Tag, Image, Empty, Popconfirm } from 'antd';
import { SearchOutlined, ClearOutlined, ReloadOutlined, ClockCircleOutlined, CheckCircleOutlined, CloseCircleOutlined, SyncOutlined } from '@ant-design/icons';
import { listHistory, clearHistory, type HistoryEntry } from '../../api/history';
import { useProjectStore } from '../../store/projectStore';
import { thumbnailUrl, openWithSystem } from '../../api/files';
import './HistoryDialog.css';

type Props = { open: boolean; onClose: () => void; onLoad?: (entry: HistoryEntry) => void };

const STATUS_ICON: Record<string, React.ReactNode> = {
  done: <CheckCircleOutlined style={{ color: '#4caf50' }} />,
  failed: <CloseCircleOutlined style={{ color: '#f44336' }} />,
  cancelled: <CloseCircleOutlined style={{ color: '#ff9800' }} />,
  running: <SyncOutlined spin style={{ color: '#2196f3' }} />,
  queued: <ClockCircleOutlined style={{ color: '#9c27b0' }} />,
};

const STATUS_TAG_COLOR: Record<string, string> = {
  done: 'green',
  failed: 'red',
  cancelled: 'orange',
  running: 'blue',
  queued: 'purple',
};

function formatTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return '刚刚';
  if (diffMin < 60) return `${diffMin} 分钟前`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} 小时前`;
  return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function HistoryDialog({ open, onClose, onLoad }: Props) {
  const { message } = AntApp.useApp();
  const project = useProjectStore((s) => s.current);
  const [items, setItems] = useState<HistoryEntry[]>([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string | null>(null);

  const refresh = async () => {
    if (!project) return;
    try {
      const list = await listHistory(project);
      setItems(list);
    } catch (e: any) { message.error(e.message); }
  };

  useEffect(() => { if (open) refresh(); }, [open]);

  const filtered = useMemo(() => {
    let result = items;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (r) =>
          (r.name && r.name.toLowerCase().includes(q)) ||
          (r.kind && r.kind.toLowerCase().includes(q)) ||
          (r.params && JSON.stringify(r.params).toLowerCase().includes(q))
      );
    }
    if (filterStatus) {
      result = result.filter((r) => r.status === filterStatus);
    }
    return result;
  }, [items, search, filterStatus]);

  const onClear = async () => {
    if (!project) return;
    await clearHistory(project);
    refresh();
  };

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of items) {
      counts[item.status] = (counts[item.status] || 0) + 1;
    }
    return counts;
  }, [items]);

  return (
    <Modal
      title={<span className="hd-title">生成历史</span>}
      open={open}
      onCancel={onClose}
      width={860}
      footer={null}
      className="hd-modal"
    >
      {/* 统计栏 */}
      <div className="hd-stats">
        <div className="hd-stat-item">
          <span className="hd-stat-num">{items.length}</span>
          <span className="hd-stat-label">总计</span>
        </div>
        {(['done', 'failed', 'running', 'queued'] as const).map((s) => (
          <div
            key={s}
            className={`hd-stat-item ${filterStatus === s ? 'active' : ''}`}
            onClick={() => setFilterStatus(filterStatus === s ? null : s)}
          >
            {STATUS_ICON[s]}
            <span className="hd-stat-num">{statusCounts[s] || 0}</span>
            <span className="hd-stat-label">{s === 'done' ? '成功' : s === 'failed' ? '失败' : s === 'running' ? '执行中' : '排队中'}</span>
          </div>
        ))}
      </div>

      {/* 工具栏 */}
      <div className="hd-toolbar">
        <Input
          prefix={<SearchOutlined />}
          placeholder="搜索名称/类型/参数..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          allowClear
          style={{ width: 260 }}
        />
        <Space>
          <Button icon={<ReloadOutlined />} onClick={refresh}>刷新</Button>
          <Popconfirm title="清空全部历史？" onConfirm={onClear}>
            <Button icon={<ClearOutlined />} danger>清空</Button>
          </Popconfirm>
        </Space>
      </div>

      {/* 时间轴 */}
      {filtered.length === 0 ? (
        <Empty description="暂无记录" style={{ padding: 40 }} />
      ) : (
        <div className="hd-timeline">
          {filtered.map((r, idx) => (
            <div key={`${r.ts}_${r.output_node_id}_${idx}`} className="hd-timeline-item">
              {/* 时间轴节点 */}
              <div className="hd-timeline-node">
                <div className={`hd-timeline-dot dot-${r.status}`}>
                  {STATUS_ICON[r.status]}
                </div>
                {idx < filtered.length - 1 && <div className="hd-timeline-line" />}
              </div>

              {/* 内容卡片 */}
              <div
                className={`hd-timeline-card card-${r.status}`}
                onDoubleClick={() => onLoad?.(r)}
              >
                <div className="hd-card-header">
                  <span className="hd-card-time">
                    <ClockCircleOutlined style={{ marginRight: 4, fontSize: 10 }} />
                    {formatTime(r.ts)}
                  </span>
                  <Tag color={STATUS_TAG_COLOR[r.status]}>{r.status}</Tag>
                </div>

                <div className="hd-card-body">
                  {project && r.result_path && (
                    <div className="hd-card-thumb">
                      <Image
                        width={80} height={50}
                        src={thumbnailUrl(project, r.result_path.replace(/\\/g, '/').split('/').pop()!)}
                        preview={{ mask: '预览' }}
                        style={{ objectFit: 'cover', borderRadius: 4 }}
                        onClick={() => r.result_path && openWithSystem(`${project}/${r.result_path.replace(/\\/g, '/').split('/').pop()!}`)}
                      />
                    </div>
                  )}
                  <div className="hd-card-info">
                    <div className="hd-card-name">{r.name || '未命名'}</div>
                    <div className="hd-card-kind">{r.kind}</div>
                    {r.params && (
                      <div className="hd-card-params">
                        {Object.entries(r.params as Record<string, any>).slice(0, 3).map(([k, v]) => (
                          <Tag key={k} className="hd-param-tag">{k}: {typeof v === 'string' ? v.slice(0, 30) : JSON.stringify(v).slice(0, 30)}</Tag>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="hd-card-footer">
                  <span className="hd-card-ts">{new Date(r.ts).toLocaleString()}</span>
                  <Button size="small" type="link" onClick={() => onLoad?.(r)}>加载参数</Button>
                </div>

                {/* 卡片边框光效 */}
                <div className="hd-card-glow" />
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}