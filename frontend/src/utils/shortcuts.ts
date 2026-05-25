/**
 * 快捷键系统 — 统一快捷键定义与描述。
 *
 * 所有快捷键在此集中注册，供 useShortcuts hook 和帮助面板使用。
 */

export interface ShortcutDef {
  /** 显示标签（如 "Ctrl+Z"） */
  label: string;
  /** 描述 */
  description: string;
  /** 按键值（KeyboardEvent.key） */
  key: string;
  /** 需要 Ctrl / Meta */
  ctrl: boolean;
  /** 需要 Shift */
  shift: boolean;
  /** 需要 Alt */
  alt: boolean;
  /** 分组 */
  group: string;
}

export const SHORTCUTS: ShortcutDef[] = [
  // --- 编辑 ---
  { label: 'Ctrl+Z', description: '撤销', key: 'z', ctrl: true, shift: false, alt: false, group: '编辑' },
  { label: 'Ctrl+Y', description: '重做', key: 'y', ctrl: true, shift: false, alt: false, group: '编辑' },
  { label: 'Ctrl+C', description: '复制选中节点', key: 'c', ctrl: true, shift: false, alt: false, group: '编辑' },
  { label: 'Ctrl+V', description: '粘贴节点', key: 'v', ctrl: true, shift: false, alt: false, group: '编辑' },
  { label: 'Delete', description: '删除选中节点/连线', key: 'Delete', ctrl: false, shift: false, alt: false, group: '编辑' },
  { label: 'Ctrl+A', description: '全选节点', key: 'a', ctrl: true, shift: false, alt: false, group: '编辑' },

  // --- 工作流 ---
  { label: 'Ctrl+S', description: '保存当前工作流', key: 's', ctrl: true, shift: false, alt: false, group: '工作流' },
  { label: 'Ctrl+E', description: '执行当前工作流', key: 'e', ctrl: true, shift: false, alt: false, group: '工作流' },
  { label: 'Space', description: '播放/暂停预览', key: ' ', ctrl: false, shift: false, alt: false, group: '工作流' },

  // --- 导航 ---
  { label: '↑ ↓ ← →', description: '微调选中节点位置 (10px)', key: 'ArrowUp', ctrl: false, shift: false, alt: false, group: '导航' },

  // --- 视图 ---
  { label: 'Ctrl+滚轮', description: '缩放画布', key: 'Control', ctrl: true, shift: false, alt: false, group: '视图' },
  { label: 'Ctrl+点击节点', description: '选中关联子图', key: 'Control', ctrl: true, shift: false, alt: false, group: '视图' },
];

/** 按分组归类的快捷键（用于帮助面板展示） */
export function getGroupedShortcuts(): Record<string, ShortcutDef[]> {
  const groups: Record<string, ShortcutDef[]> = {};
  for (const s of SHORTCUTS) {
    if (!groups[s.group]) groups[s.group] = [];
    groups[s.group].push(s);
  }
  return groups;
}