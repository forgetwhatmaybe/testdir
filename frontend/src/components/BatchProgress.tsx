/**
 * 批量处理进度面板 — 赛博朋克风格。
 *
 * 功能：
 * - 炫酷环形进度条动画（纯 CSS/SVG）
 * - 成功/失败/处理中文件列表
 * - 批量结果下载按钮
 * - 实时进度更新
 */
import { useEffect, useMemo, useState, useCallback } from 'react';
import { App as AntApp, Progress, Button, List, Tag, Tooltip } from 'antd';
import {
  CheckCircleFilled, CloseCircleFilled, LoadingOutlined,
  DownloadOutlined, ClearOutlined,
} from '@ant-design/icons';

export interface BatchFileItem {
  name: string;
  path: string;
  status: 'pending' | 'processing' | 'success' | 'failed';
  progress: number;  // 0-100
  error?: string;
  compressedSize?: string;  // "5.2MB → 3.1MB"
}

interface Props {
  visible: boolean;
  title?: string;
  items: BatchFileItem[];
  overallProgress: number;  // 0-100
  phase?: string;  // 当前阶段描述
  onDownloadAll?: () => void;
  onClear?: () => void;
  onClose: () => void;
}

function RingProgress({ percent, size = 120, strokeWidth = 8 }: { percent: number; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  const color = percent >= 100
    ? '#4caf50'
    : percent >= 50
    ? '#2196f3'
    : '#ff9800';

  return (
    <div className="batch-ring-progress" style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* 背景圆环 */}
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="transparent"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={strokeWidth}
        />
        {/* 发光轨道 */}
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="transparent"
          stroke="rgba(255,255,255,0.04)"
          strokeWidth={strokeWidth + 4}
          style={{ filter: `blur(4px)` }}
        />
        {/* 进度弧 */}
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="transparent"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            transition: 'stroke-dashoffset 0.5s ease, stroke 0.5s ease',
            filter: `drop-shadow(0 0 8px ${color})`,
            transform: 'rotate(-90deg)',
            transformOrigin: 'center',
          }}
        />
        {/* 脉冲光点 */}
        {percent > 0 && percent < 100 && (
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="transparent"
            stroke="rgba(255,255,255,0.4)"
            strokeWidth={strokeWidth + 2}
            strokeLinecap="round"
            strokeDasharray={`${circumference * 0.02} ${circumference * 0.98}`}
            strokeDashoffset={offset}
            style={{
              transform: 'rotate(-90deg)',
              transformOrigin: 'center',
              animation: 'ringPulse 1.5s ease-in-out infinite',
            }}
          />
        )}
      </svg>
      <div className="batch-ring-center" style={{
        position: 'absolute',
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 28, fontWeight: 'bold', color, textShadow: `0 0 12px ${color}` }}>
          {percent}
        </div>
        <div style={{ fontSize: 11, color: '#999' }}>%</div>
      </div>
    </div>
  );
}

export default function BatchProgress({
  visible, title = '批量处理', items, overallProgress, phase,
  onDownloadAll, onClear, onClose,
}: Props) {
  const { message } = AntApp.useApp();

  const stats = useMemo(() => {
    const total = items.length;
    const success = items.filter(i => i.status === 'success').length;
    const failed = items.filter(i => i.status === 'failed').length;
    const processing = items.filter(i => i.status === 'processing').length;
    return { total, success, failed, processing };
  }, [items]);

  if (!visible) return null;

  const statusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircleFilled style={{ color: '#4caf50', fontSize: 16 }} />;
      case 'failed': return <CloseCircleFilled style={{ color: '#f44336', fontSize: 16 }} />;
      case 'processing': return <LoadingOutlined style={{ color: '#2196f3', fontSize: 16 }} spin />;
      default: return <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#666', display: 'inline-block' }} />;
    }
  };

  const statusTag = (status: string) => {
    switch (status) {
      case 'success': return <Tag color="success">完成</Tag>;
      case 'failed': return <Tag color="error">失败</Tag>;
      case 'processing': return <Tag color="processing">处理中</Tag>;
      default: return <Tag>等待</Tag>;
    }
  };

  return (
    <div className="batch-progress-overlay" onClick={(e) => e.target === e.currentTarget && onClose()} role="dialog" aria-modal="true" aria-label={title}>
      <div className="batch-progress-panel">
        {/* 标题栏 */}
        <div className="batch-progress-header">
          <h3 className="glitch-text-mini" data-text={title}>{title}</h3>
          <Button type="text" size="small" onClick={onClose} style={{ color: '#999' }}>✕</Button>
        </div>

        {/* 环形进度 + 统计 */}
        <div className="batch-progress-body">
          <div className="batch-progress-ring-wrap" role="progressbar" aria-valuenow={overallProgress} aria-valuemin={0} aria-valuemax={100} aria-label={`整体进度 ${overallProgress}%`}>
            <RingProgress percent={overallProgress} size={140} strokeWidth={10} />
            {phase && <div style={{ marginTop: 8, fontSize: 12, color: '#888' }}>{phase}</div>}
          </div>

          <div className="batch-progress-stats">
            <div className="stat-item">
              <span className="stat-label">总数</span>
              <span className="stat-value">{stats.total}</span>
            </div>
            <div className="stat-item" style={{ color: '#4caf50' }}>
              <span className="stat-label">成功</span>
              <span className="stat-value">{stats.success}</span>
            </div>
            <div className="stat-item" style={{ color: '#f44336' }}>
              <span className="stat-label">失败</span>
              <span className="stat-value">{stats.failed}</span>
            </div>
            <div className="stat-item" style={{ color: '#2196f3' }}>
              <span className="stat-label">进行中</span>
              <span className="stat-value">{stats.processing}</span>
            </div>
          </div>
        </div>

        {/* 整体进度条 */}
        <div style={{ padding: '0 20px' }}>
          <Progress
            percent={overallProgress}
            showInfo={false}
            strokeColor={{
              '0%': '#7b1fa2',
              '50%': '#2196f3',
              '100%': '#4caf50',
            }}
            trailColor="rgba(255,255,255,0.05)"
            strokeWidth={4}
          />
        </div>

        {/* 文件列表 */}
        <div className="batch-progress-list">
          {items.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#555', padding: 20 }}>暂无文件</div>
          ) : (
            items.map((item, idx) => (
              <div key={idx} className={`batch-file-item ${item.status}`}>
                <div className="batch-file-icon">{statusIcon(item.status)}</div>
                <div className="batch-file-info">
                  <Tooltip title={item.path}>
                    <div className="batch-file-name">{item.name}</div>
                  </Tooltip>
                  {item.compressedSize && (
                    <div className="batch-file-compress">{item.compressedSize}</div>
                  )}
                  {item.error && (
                    <div className="batch-file-error">{item.error}</div>
                  )}
                </div>
                <div className="batch-file-tag">{statusTag(item.status)}</div>
                {item.status === 'processing' && (
                  <div className="batch-file-bar">
                    <div className="batch-file-bar-fill" style={{ width: `${item.progress}%` }} />
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* 底部操作栏 */}
        {overallProgress >= 100 && (
          <div className="batch-progress-footer">
            {onDownloadAll && (
              <Button icon={<DownloadOutlined />} type="primary" ghost onClick={onDownloadAll}>
                下载全部结果
              </Button>
            )}
            {onClear && (
              <Button icon={<ClearOutlined />} onClick={onClear}>
                清空列表
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}