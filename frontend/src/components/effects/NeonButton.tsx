import type { CSSProperties, ReactNode } from 'react';
import { Button } from 'antd';
import './NeonButton.css';

type Theme = 'purple' | 'blue' | 'green' | 'red';

interface Props {
  children?: ReactNode;
  theme?: Theme;
  icon?: ReactNode;
  disabled?: boolean;
  loading?: boolean;
  style?: CSSProperties;
  className?: string;
  onClick?: (e: React.MouseEvent<HTMLElement>) => void;
}

const THEME_MAP: Record<Theme, { border: string; glow: string; text: string }> = {
  purple: { border: '#a78bfa', glow: 'rgba(167, 139, 250, 0.6)', text: '#c4b5fd' },
  blue:   { border: '#60a5fa', glow: 'rgba(96, 165, 250, 0.6)',   text: '#93c5fd' },
  green:  { border: '#34d399', glow: 'rgba(52, 211, 153, 0.6)',   text: '#6ee7b7' },
  red:    { border: '#f87171', glow: 'rgba(248, 113, 113, 0.6)',   text: '#fca5a5' },
};

export default function NeonButton({
  children, theme = 'purple', icon, disabled, loading, style, className, onClick,
}: Props) {
  const t = THEME_MAP[theme];

  return (
    <Button
      className={`neon-glow-btn ${className || ''}`}
      icon={icon}
      disabled={disabled}
      loading={loading}
      onClick={onClick}
      style={{
        ...style,
        '--neon-border': t.border,
        '--neon-glow': t.glow,
        '--neon-text': t.text,
      } as CSSProperties}
    >
      {children}
    </Button>
  );
}