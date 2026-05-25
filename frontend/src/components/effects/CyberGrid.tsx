/**
 * 赛博朋克风格透视网格背景 — 全屏覆盖特效。
 *
 * 效果：
 * - 透视网格（消失点向中心汇聚）
 * - 扫描线效果（CRT 复古感）
 * - 动态光晕扫描（周期性横向扫描）
 * - 可调节透明度 / 颜色 / 速度
 */
import { useMemo } from 'react';

interface Props {
  /** 网格线颜色 */
  color?: string;
  /** 网格间距（像素） */
  spacing?: number;
  /** 透明度 0-1 */
  opacity?: number;
  /** 扫描速度（秒）*/
  scanSpeed?: number;
  /** 是否启用光晕扫描 */
  enableScan?: boolean;
  /** 是否启用扫描线 */
  enableScanlines?: boolean;
}

export default function CyberGrid({
  color = '#7b1fa2',
  spacing = 60,
  opacity = 0.12,
  scanSpeed = 4,
  enableScan = true,
  enableScanlines = true,
}: Props) {
  const style = useMemo(() => {
    const halfSpacing = spacing / 2;
    return {
      position: 'fixed' as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      pointerEvents: 'none' as const,
      zIndex: 0,
      opacity,
      // 透视网格
      backgroundImage: `
        linear-gradient(
          to bottom,
          transparent ${spacing - 1}px,
          ${color} ${spacing}px
        ),
        linear-gradient(
          to right,
          transparent ${spacing - 1}px,
          ${color} ${spacing}px
        )
      `,
      backgroundSize: `${spacing}px ${spacing}px`,
      // 透视变换模拟（CSS perspective 需要父级容器）
      transform: 'perspective(800px) rotateX(60deg) scaleY(2.2)',
      transformOrigin: 'center top',
      maskImage: 'radial-gradient(ellipse 80% 60% at 50% 35%, black 30%, transparent 70%)',
      WebkitMaskImage: 'radial-gradient(ellipse 80% 60% at 50% 35%, black 30%, transparent 70%)',
    };
  }, [color, spacing, opacity]);

  return (
    <>
      {/* 透视网格层 */}
      <div style={style} />

      {/* 扫描线层 */}
      {enableScanlines && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          pointerEvents: 'none',
          zIndex: 0,
          opacity: 0.05,
          backgroundImage: `repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            rgba(0, 0, 0, 0.3) 2px,
            rgba(0, 0, 0, 0.3) 4px
          )`,
        }} />
      )}

      {/* 动态光晕扫描 */}
      {enableScan && (
        <div className="cyber-scan-line" style={{
          position: 'fixed',
          top: 0, left: 0, right: 0,
          pointerEvents: 'none',
          zIndex: 0,
          height: 3,
          background: `linear-gradient(90deg,
            transparent 0%,
            ${color}66 20%,
            ${color}aa 50%,
            ${color}66 80%,
            transparent 100%
          )`,
          boxShadow: `0 0 20px ${color}, 0 0 40px ${color}66`,
          animation: `cyberScan ${scanSpeed}s linear infinite`,
        }} />
      )}
    </>
  );
}