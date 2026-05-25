import { Component, type ErrorInfo, type ReactNode } from 'react';
import ErrorFallback from './ErrorFallback';

type Props = {
  children: ReactNode;
  /** 自定义降级标题 */
  fallbackTitle?: string;
  /** 重试回调 */
  onRetry?: () => void;
};

type State = {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
};

/**
 * React 错误边界 — 捕获子组件渲染异常，展示炫酷降级页。
 * 用法：<ErrorBoundary><YourComponent /></ErrorBoundary>
 */
class ErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });
    console.error('[ErrorBoundary] 捕获渲染异常:', error, errorInfo);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    this.props.onRetry?.();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <ErrorFallback
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          title={this.props.fallbackTitle}
          onRetry={this.handleRetry}
        />
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;