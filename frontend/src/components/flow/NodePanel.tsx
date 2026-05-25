import { useMemo } from 'react';
import { nodeMeta } from './nodes/index';

export default function NodePanel() {
  const onDragStart = (e: React.DragEvent, type: string) => {
    e.dataTransfer.setData('application/reactflow-node-type', type);
    e.dataTransfer.effectAllowed = 'move';
  };

  const groups = useMemo(() => {
    const m: Record<string, [string, { label: string; color: string }][]> = {};
    for (const [type, meta] of Object.entries(nodeMeta)) {
      (m[meta.group] ||= []).push([type, meta]);
    }
    return Object.entries(m);
  }, []);

  return (
    <div className="node-panel" role="complementary" aria-label="节点面板">
      <div style={{ fontSize: 12, color: '#aaa', marginBottom: 6 }}>拖拽到画布创建节点</div>
      {groups.map(([group, list]) => (
        <div key={group} style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: '#666', margin: '6px 0 4px' }}>{group}</div>
          {list.map(([type, meta]) => (
            <div
              key={type}
              draggable
              onDragStart={(e) => onDragStart(e, type)}
              style={{
                background: '#242424', border: '1px solid #2f2f2f', padding: '6px 10px',
                borderRadius: 4, marginBottom: 4, cursor: 'grab', display: 'flex',
                alignItems: 'center', gap: 6, fontSize: 12,
              }}
              role="button"
              aria-label={`创建 ${meta.label} 节点`}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  // 模拟拖拽事件（可扩展为点击创建）
                  
                }
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: meta.color }} aria-hidden="true" />
              {meta.label}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
