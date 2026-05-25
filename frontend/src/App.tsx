import { Routes, Route, Navigate } from 'react-router-dom';
import ProjectListPage from './pages/ProjectListPage';
import EditorPage from './pages/EditorPage';
import ApiSettingsPage from './pages/ApiSettingsPage';
import ErrorBoundary from './components/ErrorBoundary';

export default function App() {
  return (
    <ErrorBoundary fallbackTitle="应用载入异常，请刷新重试">
      <Routes>
        <Route path="/" element={<Navigate to="/projects" replace />} />
        <Route path="/projects" element={<ProjectListPage />} />
        <Route path="/editor/:name" element={<EditorPage />} />
        <Route path="/settings" element={<ApiSettingsPage />} />
      </Routes>
    </ErrorBoundary>
  );
}
