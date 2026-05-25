import { useEffect } from 'react';
import { useReactFlow } from 'reactflow';
import { useFlowStore } from '../store/flowStore';
import { collectConnected } from '../utils/upstreamWalker';
import { uniqueId, nextOutputName, nextTextOutputName } from '../utils/nodeNaming';

const TAPNOW_RX = /^TAPNOW_(IMG|VID):(.+)$/m;

export function useShortcuts(saveNow: () => Promise<void>, executeWorkflow?: () => void) {
  const rf = useReactFlow();
  const undo = useFlowStore((s) => s.undo);
  const redo = useFlowStore((s) => s.redo);
  const pushHistory = useFlowStore((s) => s.pushHistory);

  useEffect(() => {
    const onKey = async (e: KeyboardEvent) => {
      const meta = e.ctrlKey || e.metaKey;
      const tag = (e.target as HTMLElement)?.tagName;
      const editable = tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable;
      if (editable) {
        if (!(meta && (e.key === 's' || e.key === 'z' || e.key === 'y'))) return;
      }
      if (meta && e.key.toLowerCase() === 's') {
        e.preventDefault();
        await saveNow();
      } else if (meta && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undo();
      } else if (meta && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      } else if (meta && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        const { nodes } = useFlowStore.getState();
        useFlowStore.setState({ nodes: nodes.map((n) => ({ ...n, selected: true })) });
      } else if (e.key === 'Delete') {
        const { nodes, edges } = useFlowStore.getState();
        const removeNodeIds = new Set(nodes.filter((n) => n.selected).map((n) => n.id));
        const remainingEdges = edges.filter((edg) => !edg.selected && !removeNodeIds.has(edg.source) && !removeNodeIds.has(edg.target));
        const remainingNodes = nodes.filter((n) => !removeNodeIds.has(n.id));
        if (removeNodeIds.size === 0 && remainingEdges.length === edges.length) return;
        useFlowStore.setState({ nodes: remainingNodes, edges: remainingEdges });
        pushHistory();
      } else if (meta && e.key.toLowerCase() === 'c') {
        const { nodes, edges, setClipboard } = useFlowStore.getState();
        const selected = nodes.filter((n) => n.selected);
        if (!selected.length) return;
        const ids = new Set(selected.map((n) => n.id));
        const internalEdges = edges.filter((eg) => ids.has(eg.source) && ids.has(eg.target));
        setClipboard({
          nodes: JSON.parse(JSON.stringify(selected)),
          edges: JSON.parse(JSON.stringify(internalEdges)),
        });
      } else if (meta && e.key.toLowerCase() === 'v') {
        // 优先：系统剪贴板里包含 TAPNOW 前缀 → 创建 image/video 节点
        try {
          const text = await navigator.clipboard.readText();
          const m = text && text.match(TAPNOW_RX);
          if (m) {
            e.preventDefault();
            const isImg = m[1] === 'IMG';
            const path = m[2].trim();
            // path 是绝对路径，但前端只显示项目相对路径（rawUrl）。这里取文件名当 image_path/video_path
            // 用户可在节点内继续上传新文件覆盖。
            const fileName = path.replace(/\\/g, '/').split('/').pop() || path;
            const mouse = (window as any).__lastMousePos || { x: 200, y: 200 };
            const flowPos = rf.screenToFlowPosition(mouse);
            const id = uniqueId('n');
            const data: any = isImg ? { image_path: fileName } : { video_path: fileName };
            const newNode = {
              id, type: isImg ? 'image' : 'video',
              position: { x: flowPos.x, y: flowPos.y },
              data,
            };
            const { nodes } = useFlowStore.getState();
            useFlowStore.setState({
              nodes: [...nodes.map((n) => ({ ...n, selected: false })), { ...newNode, selected: true } as any],
            });
            pushHistory();
            return;
          }
        } catch {
          // ignore clipboard read errors
        }
        // 默认行为：粘贴节点
        const { clipboard, nodes, edges } = useFlowStore.getState();
        if (!clipboard) return;
        e.preventDefault();
        const mouse = (window as any).__lastMousePos || { x: 200, y: 200 };
        const flowPos = rf.screenToFlowPosition(mouse);
        const minX = Math.min(...clipboard.nodes.map((n) => n.position.x));
        const minY = Math.min(...clipboard.nodes.map((n) => n.position.y));
        const idMap = new Map<string, string>();
        const stamp = Date.now();
        const allNodesSoFar = [...nodes];
        const newNodes = clipboard.nodes.map((n) => {
          const newId = uniqueId('n');
          idMap.set(n.id, newId);
          const data = { ...(n.data as any) };
          if (n.type === 'output') {
            data.name = nextOutputName(allNodesSoFar);
            allNodesSoFar.push({ ...n, id: newId, data });
          } else if (n.type === 'text_display') {
            data.name = nextTextOutputName(allNodesSoFar);
            allNodesSoFar.push({ ...n, id: newId, data });
          }
          return {
            ...n, id: newId, selected: true,
            position: {
              x: flowPos.x + (n.position.x - minX),
              y: flowPos.y + (n.position.y - minY),
            },
            data,
          };
        });
        const newEdges = clipboard.edges.map((edg) => ({
          ...edg,
          id: `e_${stamp}_${Math.random().toString(36).slice(2, 6)}`,
          source: idMap.get(edg.source)!,
          target: idMap.get(edg.target)!,
          selected: false,
        }));
        useFlowStore.setState({
          nodes: [...nodes.map((n) => ({ ...n, selected: false })), ...newNodes],
          edges: [...edges, ...newEdges],
        });
        pushHistory();
      } else if (meta && e.key.toLowerCase() === 'e') {
        // Ctrl+E: 执行工作流
        e.preventDefault();
        if (executeWorkflow) executeWorkflow();
      } else if (e.key === ' ' || e.code === 'Space') {
        // Space: 播放/暂停预览（仅在非编辑区域）
        if (!editable) {
          e.preventDefault();
          // 广播 Space 事件给视频/音频预览组件
          window.dispatchEvent(new CustomEvent('shortcut:space'));
        }
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        const { nodes } = useFlowStore.getState();
        const sel = nodes.filter((n) => n.selected);
        if (!sel.length) return;
        e.preventDefault();
        const dx = e.key === 'ArrowLeft' ? -10 : e.key === 'ArrowRight' ? 10 : 0;
        const dy = e.key === 'ArrowUp' ? -10 : e.key === 'ArrowDown' ? 10 : 0;
        useFlowStore.setState({
          nodes: nodes.map((n) => n.selected
            ? { ...n, position: { x: n.position.x + dx, y: n.position.y + dy } }
            : n),
        });
      }
    };
    const onMouseMove = (e: MouseEvent) => {
      (window as any).__lastMousePos = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousemove', onMouseMove);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousemove', onMouseMove);
    };
  }, [rf, undo, redo, pushHistory, saveNow]);
}
