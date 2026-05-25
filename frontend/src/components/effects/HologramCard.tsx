import { useEffect, useRef, useState, type ReactNode } from 'react';
import './HologramCard.css';

interface Props {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  /** 倾斜强度（默认 15） */
  tilt?: number;
}

export default function HologramCard({ children, className, style, tilt = 15 }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [rotation, setRotation] = useState({ x: 0, y: 0 });
  const [glowPos, setGlowPos] = useState({ x: 50, y: 50 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onMouseMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = (e.clientX - cx) / (rect.width / 2);
      const dy = (e.clientY - cy) / (rect.height / 2);
      setRotation({ x: -dy * tilt, y: dx * tilt });
      setGlowPos({
        x: ((e.clientX - rect.left) / rect.width) * 100,
        y: ((e.clientY - rect.top) / rect.height) * 100,
      });
    };

    const onMouseLeave = () => {
      setRotation({ x: 0, y: 0 });
      setGlowPos({ x: 50, y: 50 });
    };

    el.addEventListener('mousemove', onMouseMove);
    el.addEventListener('mouseleave', onMouseLeave);
    return () => {
      el.removeEventListener('mousemove', onMouseMove);
      el.removeEventListener('mouseleave', onMouseLeave);
    };
  }, [tilt]);

  return (
    <div
      ref={ref}
      className={`holo-card ${className || ''}`}
      style={{
        ...style,
        '--holo-rot-x': `${rotation.x}deg`,
        '--holo-rot-y': `${rotation.y}deg`,
        '--holo-glow-x': `${glowPos.x}%`,
        '--holo-glow-y': `${glowPos.y}%`,
      } as React.CSSProperties}
    >
      <div className="holo-card-scan" />
      <div className="holo-card-glare" />
      <div className="holo-card-content">{children}</div>
    </div>
  );
}