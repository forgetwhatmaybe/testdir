import { api, postJson } from './client';

export async function uploadFile(project: string, file: File): Promise<{ rel_path: string; abs_path: string }> {
  const fd = new FormData();
  fd.append('project', project);
  fd.append('file', file);
  const r = await api.post('/files/upload', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return r.data.data;
}

export function rawUrl(project: string, path: string) {
  return `/api/files/raw?project=${encodeURIComponent(project)}&path=${encodeURIComponent(path)}`;
}

export function thumbnailUrl(project: string, path: string) {
  return `/api/files/thumbnail?project=${encodeURIComponent(project)}&path=${encodeURIComponent(path)}`;
}

export function openFolder(path: string) {
  return postJson<void>('/files/open-folder', { path });
}

export function openWithSystem(path: string) {
  return postJson<void>('/files/open-with-system', { path });
}

export function downloadFile(project: string, path: string) {
  const url = rawUrl(project, path);
  const a = document.createElement('a');
  a.href = url;
  a.download = path.split('/').pop() || 'download';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export function saveMask(project: string, image_name: string, png_base64: string) {
  return postJson<{ rel_path: string; abs_path: string }>('/files/save-mask', {
    project, image_name, png_base64,
  });
}
