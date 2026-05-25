import { getJson, postJson, putJson } from './client';

export type ApiKeyEntry = { provider: string; fields: Record<string, string> };

export function getKeys() {
  return getJson<{ keys: ApiKeyEntry[] }>('/settings/api-keys');
}

export function saveKeys(keys: ApiKeyEntry[]) {
  return putJson<void>('/settings/api-keys', { keys });
}

export function testConnection(provider: string) {
  return postJson<{ connected: boolean }>('/settings/test-connection', { provider });
}

export function getHelpText() {
  return getJson<string[]>('/settings/help-text');
}

export function getTemplates() {
  return getJson<any[]>('/settings/templates');
}

export function getGeneral() {
  return getJson<{ show_help_panel: boolean; default_disk: string }>('/settings/general');
}

export function putGeneral(v: { show_help_panel: boolean; default_disk: string }) {
  return putJson<void>('/settings/general', v);
}
