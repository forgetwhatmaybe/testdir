import React from 'react';
import ReactDOM from 'react-dom/client';
import { App as AntApp, ConfigProvider, theme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { BrowserRouter } from 'react-router-dom';
import 'reactflow/dist/style.css';
import './styles/global.css';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: '#5f8fcb',
          colorInfo: '#5f8fcb',
          colorSuccess: '#4da67d',
          colorWarning: '#c9985c',
          colorError: '#c96a78',
          colorBgBase: '#080b11',
          colorBgLayout: '#0d121a',
          colorBgContainer: '#11161f',
          colorBgElevated: '#171d28',
          colorFillSecondary: 'rgba(255, 255, 255, 0.06)',
          colorFillTertiary: 'rgba(255, 255, 255, 0.04)',
          colorBorder: 'rgba(160, 176, 201, 0.20)',
          colorBorderSecondary: 'rgba(160, 176, 201, 0.12)',
          colorText: '#eef3fb',
          colorTextSecondary: '#b6c2d6',
          colorTextTertiary: '#7e8aa2',
          colorTextQuaternary: '#596577',
          fontFamily: 'Aptos, Segoe UI, PingFang SC, Microsoft YaHei, sans-serif',
          borderRadius: 12,
          boxShadowSecondary: '0 20px 48px rgba(0, 0, 0, 0.34)',
          controlItemBgActive: 'rgba(95, 143, 203, 0.18)',
          controlItemBgHover: 'rgba(95, 143, 203, 0.10)',
        },
      }}
    >
      <AntApp>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </AntApp>
    </ConfigProvider>
  </React.StrictMode>,
);
