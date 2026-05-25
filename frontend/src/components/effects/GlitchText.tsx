/**
 * 故障艺术 (Glitch Art) 风格文字组件。
 *
 * 效果：
 * - 文字 RGB 通道偏移抖动
 * - 随机闪烁 / 裁剪效果
 * - 可控触发（hover / active / 持续）
 * - 赛博朋克风格光晕
 */
import { useMemo } from 'react';

interface Props {
  /** 显示文字 */
  text: string;
  /** 字号 */
  fontSize?: number | string;
  /** 文字颜色 */
  color?: string;
  /** 发光颜色 */
  glowColor?: string;
  /** 触发模式 */
  mode?: 'always' | 'hover' | 'none';
  /** 故障强度 0-1 */
  intensity?: number;
  /** 自定义类名 */
  className?: string;
  /** 内联样式 */
  style?: React.CSSProperties;
}

export default function GlitchText({
  text,
  fontSize = 24,
  color = '#fff',
  glowColor = '#7b1fa2',
  mode = 'hover',
  intensity = 0.6,
  className = '',
  style: outerStyle = {},
}: Props) {
  const glitchClass = mode === 'always' ? 'glitch-text-always'
    : mode === 'hover' ? 'glitch-text-hover'
    : '';

  const offset = Math.round(intensity * 4);
  const blur = Math.round(intensity * 2);

  const containerStyle: React.CSSProperties = useMemo(() => ({
    position: 'relative' as const,
    display: 'inline-block',
    fontSize,
    fontWeight: 'bold',
    color,
    textShadow: `0 0 8px ${glowColor}, 0 0 20px ${glowColor}66, 0 0 40px ${glowColor}33`,
    ...outerStyle,
  }), [fontSize, color, glowColor, outerStyle]);

  return (
    <span className={`glitch-text ${glitchClass} ${className}`} style={containerStyle}>
      {/* 原始文字 */}
      <span className="glitch-original">{text}</span>

      {/* 红色通道偏移 */}
      <span
        className="glitch-red"
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: 0,
          left: offset,
          color: '#ff0044',
          opacity: 0.7,
          clipPath: mode === 'always' ? undefined : 'inset(0)',
          filter: `blur(${blur}px)`,
          zIndex: -1,
        }}
      >
        {text}
      </span>

      {/* 蓝色通道偏移 */}
      <span
        className="glitch-blue"
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: 0,
          left: -offset,
          color: '#00e5ff',
          opacity: 0.7,
          clipPath: mode === 'always' ? undefined : 'inset(0)',
          filter: `blur(${blur}px)`,
          zIndex: -1,
        }}
      >
        {text}
      </span>
    </span>
  );
}