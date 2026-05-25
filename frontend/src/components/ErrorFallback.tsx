import { useState, type ErrorInfo } from 'react';
import './ErrorFallback.css';

type Props = {
  error: Error | null;
  errorInfo: ErrorInfo | null;
  title?: string;
  onRetry?: () => void;
};

/** 炫酷降级 UI — 含重试按钮 + 错误详情折叠面板 */
export default function ErrorFallback({ error, errorInfo, title, onRetry }: Props) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className="error-fallback" role="alert" aria-live="assertive">
      {/* 背景粒子三角形 */}
      <div className="ef-bg">
        <div className="ef-triangle ef-tri-1" />
        <div className="ef-triangle ef-tri-2" />
        <div className="ef-triangle ef-tri-3" />
      </div>

      <div className="ef-content">
        {/* 错误图标 */}
        <div className="ef-icon" aria-hidden="true">
          <svg viewBox="0 0 120 120" fill="none">
            <circle cx="60" cy="60" r="56" stroke="currentColor" strokeWidth="3" opacity="0.3" />
            <circle cx="60" cy="60" r="56" stroke="currentColor" strokeWidth="3"
              strokeDasharray="352" strokeDashoffset="80" opacity="0.6">
              <animate attributeName="stroke-dashoffset" from="352" to="0" dur="1.5s" fill="freeze" />
            </circle>
            <text x="60" y="52" textAnchor="middle" fill="currentColor"
              fontSize="36" fontWeight="bold">!</text>
            <text x="60" y="88" textAnchor="middle" fill="currentColor"
              fontSize="13" opacity="0.6">ERROR</text>
          </svg>
        </div>

        {/* 提示文字 */}
        <h1 className="ef-title">{title ?? '组件渲染异常'}</h1>
        <p className="ef-desc">
          运行时发生了未预期的错误。请尝试重试，或联系开发者。
        </p>

        {/* 错误信息 */}
        {error && (
          <p className="ef-message" aria-label={`错误信息: ${error.message}`}>
            {error.message}
          </p>
        )}

        {/* 操作按钮 */}
        <div className="ef-actions">
          {onRetry && (
            <button
              className="ef-btn ef-btn-primary"
              onClick={onRetry}
              aria-label="重试加载组件"
            >
              重试
            </button>
          )}
          <button
            className="ef-btn ef-btn-secondary"
            onClick={() => window.location.reload()}
            aria-label="刷新页面"
          >
            刷新页面
          </button>
        </div>

        {/* 错误详情折叠面板 */}
        {errorInfo && (
          <div className="ef-details">
            <button
              className="ef-details-toggle"
              onClick={() => setShowDetails((v) => !v)}
              aria-expanded={showDetails}
              aria-controls="ef-details-panel"
              aria-label={showDetails ? '收起错误详情' : '展开错误详情'}
            >
              {showDetails ? '▲' : '▼'} 技术详情
            </button>
            {showDetails && (
              <pre className="ef-details-panel" id="ef-details-panel" aria-label="错误堆栈">
                {error?.stack?.slice(0, 2000) ?? error?.message}
                {'\n\nComponent Stack:\n'}
                {errorInfo?.componentStack?.slice(0, 2000)}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}