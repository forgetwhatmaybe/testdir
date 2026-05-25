import { useEffect, useState } from 'react';
import { useTaskStore } from '../../store/taskStore';

export default function StatusBanner() {
  const tasks = useTaskStore((s) => s.tasks);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const all = Object.values(tasks);
  const running = all.filter((t) => ['queued', 'running'].includes(t.status));
  const failed = all.filter((t) => t.status === 'failed');

  if (running.length > 0) {
    return (
      <div className="banner banner-info">
        ⚡ 执行中 {running.length} · {running.map((t) => `${t.name}(${t.progress}%)`).join('  ·  ')}
      </div>
    );
  }
  if (all.length > 0 && failed.length === 0 && all.every((t) => t.status === 'done')) {
    return (
      <div className="banner banner-success">✅ 所有任务已完成</div>
    );
  }
  if (failed.length > 0) {
    return (
      <div className="banner banner-failed">❌ 失败 {failed.length} · {failed[0].message}</div>
    );
  }
  return null;
}
