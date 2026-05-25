import { useState } from 'react';
import { Button, Space, Tooltip, Badge, App as AntApp } from 'antd';
import {
  ArrowLeftOutlined, SaveOutlined, UndoOutlined, RedoOutlined, AppstoreAddOutlined,
  OrderedListOutlined, SettingOutlined, PlayCircleOutlined, StopOutlined, HistoryOutlined,
  EyeOutlined, EyeInvisibleOutlined, MenuOutlined, CloseOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useFlowStore } from '../../store/flowStore';
import { useTaskStore } from '../../store/taskStore';
import { runTasks, cancelAll } from '../../api/tasks';
import NeonButton from '../effects/NeonButton';

type Props = {
  projectName: string;
  saveNow: () => Promise<void>;
  onOpenQueue: () => void;
  onOpenTemplates: () => void;
  onOpenHistory: () => void;
  onToggleHelp: () => void;
  showHelp: boolean;
};

export default function Toolbar({ projectName, saveNow, onOpenQueue, onOpenTemplates, onOpenHistory, onToggleHelp, showHelp }: Props) {
  const { message } = AntApp.useApp();
  const nav = useNavigate();
  const undo = useFlowStore((s) => s.undo);
  const redo = useFlowStore((s) => s.redo);
  const tasks = useTaskStore((s) => s.tasks);
  const running = Object.values(tasks).filter((t) => ['queued', 'running'].includes(t.status)).length;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const onRunSelected = async () => {
    const { nodes, edges, viewport } = useFlowStore.getState();
    const selected = nodes.filter((n) => n.selected && (n.type === 'output' || n.type === 'text_display'));
    const targets = selected.length ? selected : nodes.filter((n) => n.type === 'output' || n.type === 'text_display');
    if (!targets.length) { message.warning('画布上没有输出节点'); return; }
    try {
      await runTasks(projectName, { version: 2, viewport, nodes, edges }, targets.map((n) => n.id));
      message.success(`已加入 ${targets.length} 个任务`);
    } catch (e: unknown) { message.error((e as Error).message); }
  };

  const onStopAll = async () => {
    await cancelAll();
    message.success('已发起取消所有');
  };

  return (
    <div className="editor-toolbar" role="toolbar" aria-label="编辑器工具栏">
      {/* 移动端汉堡菜单 */}
      <Button
        className="toolbar-hamburger"
        icon={mobileMenuOpen ? <CloseOutlined /> : <MenuOutlined />}
        onClick={() => setMobileMenuOpen((v) => !v)}
        aria-label={mobileMenuOpen ? '收起菜单' : '展开菜单'}
        aria-expanded={mobileMenuOpen}
      />

      <Button className="toolbar-btn" icon={<ArrowLeftOutlined />} onClick={() => nav('/projects')} aria-label="返回项目列表">
        <span className="toolbar-btn-text">返回</span>
      </Button>
      <strong style={{ color: '#fff' }} aria-label={`当前项目：${projectName}`}>{projectName}</strong>
      <span style={{ flex: 1 }} />

      <Space className={`toolbar-actions ${mobileMenuOpen ? 'mobile-open' : ''}`} role="group" aria-label="工具栏按钮组">
        <Tooltip title="保存 (Ctrl+S)">
          <span>
            <Button className="toolbar-btn" icon={<SaveOutlined />} onClick={saveNow} aria-label="保存项目" />
          </span>
        </Tooltip>

        {/* 撤销/重做霓虹按钮 */}
        <Tooltip title="撤销 (Ctrl+Z)">
          <span>
            <NeonButton theme="purple" icon={<UndoOutlined />} onClick={undo} aria-label="撤销" />
          </span>
        </Tooltip>
        <Tooltip title="重做 (Ctrl+Y)">
          <span>
            <NeonButton theme="blue" icon={<RedoOutlined />} onClick={redo} aria-label="重做" />
          </span>
        </Tooltip>

        <Button className="toolbar-btn" icon={<AppstoreAddOutlined />} onClick={onOpenTemplates} aria-label="打开模板库">
          <span className="toolbar-btn-text">模板</span>
        </Button>
        <Button className="toolbar-btn" icon={<HistoryOutlined />} onClick={onOpenHistory} aria-label="打开历史记录">
          <span className="toolbar-btn-text">历史</span>
        </Button>
        <Badge count={running} aria-label={`${running} 个任务进行中`}>
          <Button className="toolbar-btn" icon={<OrderedListOutlined />} onClick={onOpenQueue} aria-label="打开任务队列">
            <span className="toolbar-btn-text">队列</span>
          </Button>
        </Badge>
        <NeonButton theme="green" icon={<PlayCircleOutlined />} onClick={onRunSelected} aria-label="执行选中节点">
          <span className="toolbar-btn-text">执行</span>
        </NeonButton>
        <Button className="toolbar-btn" danger icon={<StopOutlined />} onClick={onStopAll} aria-label="停止全部任务">
          <span className="toolbar-btn-text">停止全部</span>
        </Button>
        <Tooltip title={showHelp ? '隐藏说明面板' : '显示说明面板'}>
          <span>
            <Button className="toolbar-btn" icon={showHelp ? <EyeOutlined /> : <EyeInvisibleOutlined />} onClick={onToggleHelp} aria-label={showHelp ? '隐藏帮助' : '显示帮助'} />
          </span>
        </Tooltip>
        <Button className="toolbar-btn" icon={<SettingOutlined />} onClick={() => nav('/settings')} aria-label="打开 API 设置">
          <span className="toolbar-btn-text">API</span>
        </Button>
      </Space>
    </div>
  );
}