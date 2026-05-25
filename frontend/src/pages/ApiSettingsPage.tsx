import { useEffect, useState } from 'react';
import { Button, Form, Input, Tabs, App as AntApp, Space, Switch, Select } from 'antd';
import { useNavigate } from 'react-router-dom';
import { getKeys, saveKeys, testConnection, type ApiKeyEntry, getGeneral, putGeneral } from '../api/settings';
import { listProjects } from '../api/projects';

const PROVIDERS: { key: string; label: string; fields: { key: string; label: string; password?: boolean }[] }[] = [
  { key: 'kling',         label: '可灵 AI',     fields: [{ key: 'access_key', label: 'AccessKey' }, { key: 'secret_key', label: 'SecretKey', password: true }] },
  { key: 'jimeng',        label: '即梦 AI',     fields: [{ key: 'access_key', label: 'AccessKey' }, { key: 'secret_key', label: 'SecretKey', password: true }] },
  { key: 'gemini',        label: '香蕉 (Gemini)', fields: [{ key: 'api_key', label: 'API Key', password: true }, { key: 'base_url', label: '中转地址（可空）' }] },
  { key: 'veo3',          label: 'Veo3 视频',    fields: [{ key: 'api_key', label: 'API Key', password: true }] },
  { key: 'seedance2',     label: 'Seedance 2.0', fields: [{ key: 'api_key', label: 'API Key', password: true }] },
  { key: 'gpt_vision',    label: 'GPT-5.4',     fields: [{ key: 'api_key', label: 'API Key', password: true }, { key: 'base_url', label: '中转地址（可空）' }] },
  { key: 'gemini_vision', label: 'Gemini-3.1 Pro', fields: [{ key: 'api_key', label: 'API Key', password: true }, { key: 'base_url', label: '中转地址（可空）' }] },
];

export default function ApiSettingsPage() {
  const nav = useNavigate();
  const { message } = AntApp.useApp();
  const [keys, setKeys] = useState<Record<string, Record<string, string>>>({});
  const [general, setGeneral] = useState<{ show_help_panel: boolean; default_disk: string }>({
    show_help_panel: true, default_disk: '',
  });
  const [disks, setDisks] = useState<string[]>([]);
  const [showSecret, setShowSecret] = useState<Record<string, boolean>>({});

  useEffect(() => {
    getKeys().then((res) => {
      const map: Record<string, Record<string, string>> = {};
      for (const e of res.keys) map[e.provider] = e.fields;
      setKeys(map);
    }).catch((e) => message.error(e.message));
    getGeneral().then(setGeneral).catch(() => {});
    listProjects().then((r) => setDisks(r.disks)).catch(() => {});
  }, []);

  const onSave = async () => {
    const payload: ApiKeyEntry[] = PROVIDERS.map((p) => ({ provider: p.key, fields: keys[p.key] || {} }));
    try {
      await saveKeys(payload);
      await putGeneral(general);
      message.success('已保存');
    } catch (e: any) { message.error(e.message); }
  };

  const onTest = async (provider: string) => {
    try {
      const r = await testConnection(provider);
      message.success(r.connected ? '连接成功' : '连接失败');
    } catch (e: any) { message.error(e.message); }
  };

  const tabItems = [
    ...PROVIDERS.map((p) => ({
      key: p.key,
      label: p.label,
      children: (
        <Form layout="vertical">
          {p.fields.map((f) => (
            <Form.Item key={f.key} label={f.label}>
              <Space.Compact style={{ width: '100%' }}>
                {f.password ? (
                  <Input.Password
                    visibilityToggle={{
                      visible: !!showSecret[`${p.key}_${f.key}`],
                      onVisibleChange: (v) => setShowSecret({ ...showSecret, [`${p.key}_${f.key}`]: v }),
                    }}
                    value={keys[p.key]?.[f.key] || ''}
                    onChange={(e) => setKeys({ ...keys, [p.key]: { ...(keys[p.key] || {}), [f.key]: e.target.value } })}
                  />
                ) : (
                  <Input
                    value={keys[p.key]?.[f.key] || ''}
                    onChange={(e) => setKeys({ ...keys, [p.key]: { ...(keys[p.key] || {}), [f.key]: e.target.value } })}
                  />
                )}
              </Space.Compact>
            </Form.Item>
          ))}
          <Space>
            <Button type="primary" onClick={onSave}>保存</Button>
            <Button onClick={() => onTest(p.key)}>测试连接</Button>
          </Space>
        </Form>
      ),
    })),
    {
      key: 'general',
      label: '通用设置',
      children: (
        <Form layout="vertical">
          <Form.Item label="默认保存磁盘">
            <Select
              style={{ width: 160 }}
              value={general.default_disk}
              options={[{ value: '', label: '不设置' }, ...disks.map((d) => ({ value: d, label: `${d}:` }))]}
              onChange={(v) => setGeneral({ ...general, default_disk: v })}
            />
          </Form.Item>
          <Form.Item label="编辑器右侧使用说明面板">
            <Switch checked={general.show_help_panel} onChange={(v) => setGeneral({ ...general, show_help_panel: v })} />
          </Form.Item>
          <Button type="primary" onClick={onSave}>保存</Button>
        </Form>
      ),
    },
  ];

  return (
    <div style={{ padding: 24, maxWidth: 720, margin: '0 auto' }}>
      <Space style={{ marginBottom: 16 }}>
        <Button onClick={() => nav('/projects')}>← 返回项目</Button>
        <strong style={{ color: '#fff' }}>API 设置</strong>
      </Space>
      <Tabs items={tabItems} />
    </div>
  );
}
