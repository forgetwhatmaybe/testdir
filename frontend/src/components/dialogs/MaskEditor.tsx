import { useEffect, useRef, useState } from 'react';
import { Modal, Slider, Button, Space, Switch, App as AntApp } from 'antd';

type Props = {
  open: boolean;
  imageUrl: string;
  existingMaskUrl?: string;
  onCancel(): void;
  /** 输出 PNG dataURL，单通道：白=255 重绘，黑=0 保留 */
  onConfirm(pngBase64: string): void;
};

export default function MaskEditor({ open, imageUrl, existingMaskUrl, onCancel, onConfirm }: Props) {
  const { message } = AntApp.useApp();
  const baseRef = useRef<HTMLCanvasElement>(null);   // 显示叠加
  const maskRef = useRef<HTMLCanvasElement>(null);   // 真实蒙版（白/黑）
  const drawingRef = useRef<{ down: boolean; eraser: boolean; lastX: number; lastY: number }>({ down: false, eraser: false, lastX: -1, lastY: -1 });
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [brush, setBrush] = useState(30);
  const [eraser, setEraser] = useState(false);
  const [view, setView] = useState({ w: 600, h: 400 });

  useEffect(() => {
    if (!open) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imgRef.current = img;
      const maxW = Math.min(900, window.innerWidth - 100);
      const maxH = Math.min(600, window.innerHeight - 200);
      const ratio = img.height / img.width;
      let w = Math.min(maxW, img.width);
      let h = w * ratio;
      if (h > maxH) { h = maxH; w = h / ratio; }
      setView({ w, h });

      const base = baseRef.current!;
      const mask = maskRef.current!;
      base.width = mask.width = img.width;
      base.height = mask.height = img.height;

      const ctx = mask.getContext('2d')!;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, mask.width, mask.height);

      if (existingMaskUrl) {
        const m = new Image();
        m.crossOrigin = 'anonymous';
        m.onload = () => { ctx.drawImage(m, 0, 0, mask.width, mask.height); render(); };
        m.src = existingMaskUrl;
      }
      render();
    };
    img.src = imageUrl;
  }, [open, imageUrl, existingMaskUrl]);

  const render = () => {
    const base = baseRef.current!;
    const mask = maskRef.current!;
    const img = imgRef.current!;
    if (!base || !img) return;
    const ctx = base.getContext('2d')!;
    ctx.clearRect(0, 0, base.width, base.height);
    // 背景：原图轮廓变暗
    ctx.globalAlpha = 0.45;
    ctx.drawImage(img, 0, 0);
    ctx.globalAlpha = 1;
    // 红色蒙版叠加（来自 mask 的白色）
    const tmp = document.createElement('canvas');
    tmp.width = mask.width; tmp.height = mask.height;
    const tctx = tmp.getContext('2d')!;
    tctx.drawImage(mask, 0, 0);
    const data = tctx.getImageData(0, 0, tmp.width, tmp.height);
    for (let i = 0; i < data.data.length; i += 4) {
      const v = data.data[i];
      data.data[i] = 255;
      data.data[i + 1] = 0;
      data.data[i + 2] = 0;
      data.data[i + 3] = v > 16 ? 140 : 0;
    }
    tctx.putImageData(data, 0, 0);
    ctx.drawImage(tmp, 0, 0);
  };

  const paintCircle = (x: number, y: number, eraserMode: boolean) => {
    const mask = maskRef.current!;
    const ctx = mask.getContext('2d')!;
    ctx.fillStyle = eraserMode ? '#000' : '#fff';
    ctx.beginPath();
    ctx.arc(x, y, brush, 0, Math.PI * 2);
    ctx.fill();
  };

  const paintLine = (x0: number, y0: number, x1: number, y1: number, eraserMode: boolean) => {
    const mask = maskRef.current!;
    const ctx = mask.getContext('2d')!;
    ctx.strokeStyle = eraserMode ? '#000' : '#fff';
    ctx.lineWidth = brush * 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  };

  const evToCanvas = (e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const c = maskRef.current!;
    return {
      x: ((e.clientX - rect.left) / rect.width) * c.width,
      y: ((e.clientY - rect.top) / rect.height) * c.height,
    };
  };

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const { x, y } = evToCanvas(e);
    const isErase = e.button === 2 || eraser;
    drawingRef.current = { down: true, eraser: isErase, lastX: x, lastY: y };
    paintCircle(x, y, isErase);
    render();
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!drawingRef.current.down) return;
    const { x, y } = evToCanvas(e);
    paintLine(drawingRef.current.lastX, drawingRef.current.lastY, x, y, drawingRef.current.eraser);
    drawingRef.current.lastX = x; drawingRef.current.lastY = y;
    render();
  };
  const onMouseUp = () => {
    drawingRef.current.down = false;
  };

  const clearAll = () => {
    const mask = maskRef.current!;
    const ctx = mask.getContext('2d')!;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, mask.width, mask.height);
    render();
  };

  const submit = () => {
    const mask = maskRef.current!;
    onConfirm(mask.toDataURL('image/png'));
  };

  return (
    <Modal title="绘制蒙版（左键涂、右键擦）" open={open} onCancel={onCancel} onOk={submit}
      okText="确认" cancelText="取消" width={view.w + 80} destroyOnClose>
      <Space style={{ marginBottom: 8 }} wrap>
        <span>笔刷</span>
        <Slider min={5} max={150} value={brush} onChange={(v) => setBrush(v as number)} style={{ width: 200 }} />
        <span>{brush}</span>
        <span style={{ marginLeft: 12 }}>橡皮擦</span>
        <Switch checked={eraser} onChange={setEraser} />
        <Button danger onClick={clearAll}>清空</Button>
      </Space>
      <div style={{ position: 'relative', width: view.w, height: view.h, background: '#000', margin: '0 auto' }}>
        <canvas ref={baseRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
        <canvas ref={maskRef} style={{ display: 'none' }} />
        <div
          style={{ position: 'absolute', inset: 0, cursor: 'crosshair' }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          onContextMenu={(e) => e.preventDefault()}
        />
      </div>
    </Modal>
  );
}
