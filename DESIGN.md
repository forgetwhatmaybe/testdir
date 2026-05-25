# BU蓝昊_pic_video 重构版 设计文档

> 基于 `E:/LHX/AI/testdir` 现有 PyQt5 版本，使用 ReactFlow 重做前端，保留全部功能。
> 本文档用于一次性生成完整软件，请按章节实现。

---

## 1. 项目目标

把现有 PyQt5 桌面端节点编辑器整体迁移为 **Web 前端 + 本地后端服务** 的桌面应用，前端使用 React + ReactFlow，后端继续使用 Python（FastAPI）作为本地服务，最终通过 Electron 或 PyWebView 打包成桌面应用。所有原有功能 1:1 保留。

---

## 2. 技术栈

### 2.1 前端
- **框架**：React 18 + TypeScript + Vite
- **节点编辑器**：[`reactflow`](https://reactflow.dev/) v11+
- **UI 组件**：Ant Design 5（深色主题）
- **状态管理**：Zustand（节点/边/项目状态）
- **样式**：CSS Modules + Less（继承 testdir 深黑主题 `#1a1a1a`）
- **HTTP 客户端**：axios
- **WebSocket**：原生 WebSocket（用于任务进度实时推送）
- **媒体播放**：HTML5 `<video>` + `<canvas>`（替代 OpenCV 逐帧播放）

### 2.2 后端
- **框架**：FastAPI + Uvicorn
- **异步任务**：asyncio + 内置任务队列
- **图像处理**：Pillow + OpenCV-Python（仅用于压缩、缩略图提取、蒙版处理）
- **API 客户端**：
  - 可灵 AI（HTTP + JWT 签名）
  - 即梦 AI（火山引擎 HMAC-SHA256 签名）
  - Gemini（REST + base64 内联）
  - Veo3（向量引擎中转）
  - GPT-5.2 / Gemini-3（文本视觉）
- **配置加密**：cryptography (Fernet) 存储 API 密钥

### 2.3 桌面打包
- **首选**：Electron + electron-builder
  - 启动时由主进程 spawn `python backend/main.py`，监听 `127.0.0.1:随机端口`
  - 渲染进程加载 `http://127.0.0.1:port`
- **备选**：PyWebView（更轻量，单 exe）
- **单实例**：Electron `app.requestSingleInstanceLock()` 或 PyWebView 端 socket 锁

---

## 3. 目录结构

```
pic_video_0515/
├── README.md
├── DESIGN.md                    # 本文档
├── package.json                 # Electron 主入口
├── electron/
│   ├── main.js                  # Electron 主进程
│   ├── preload.js
│   └── single-instance.js
├── frontend/                    # React + ReactFlow
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── theme.ts             # 深色主题
│       ├── api/
│       │   ├── client.ts        # axios 实例
│       │   ├── projects.ts
│       │   ├── workflow.ts
│       │   ├── tasks.ts
│       │   └── ws.ts            # WebSocket
│       ├── store/
│       │   ├── projectStore.ts
│       │   ├── flowStore.ts     # nodes / edges
│       │   ├── taskStore.ts
│       │   └── settingsStore.ts
│       ├── pages/
│       │   ├── ProjectListPage.tsx       # 主界面：项目卡片列表
│       │   ├── EditorPage.tsx            # 节点编辑器
│       │   └── ApiSettingsPage.tsx
│       ├── components/
│       │   ├── flow/
│       │   │   ├── FlowCanvas.tsx        # ReactFlow 容器
│       │   │   ├── NodePanel.tsx         # 左侧节点面板
│       │   │   ├── HelpPanel.tsx         # 右侧使用说明（200px）
│       │   │   ├── Toolbar.tsx           # 工具栏（保存/撤销/队列/模板/API）
│       │   │   ├── ContextMenu.tsx       # 节点右键菜单
│       │   │   ├── MaskEditor.tsx        # 蒙版绘制画布
│       │   │   └── nodes/                # 自定义 ReactFlow 节点组件
│       │   │       ├── ImageNode.tsx
│       │   │       ├── VideoNode.tsx
│       │   │       ├── KlingNode.tsx
│       │   │       ├── JimengNode.tsx
│       │   │       ├── GeminiNode.tsx
│       │   │       ├── Veo3Node.tsx
│       │   │       ├── ImageEditNode.tsx
│       │   │       ├── TextVisionNode.tsx
│       │   │       ├── OutputNode.tsx
│       │   │       └── shared/
│       │   │           ├── NodeShell.tsx
│       │   │           ├── PromptInput.tsx
│       │   │           ├── ParamSelect.tsx
│       │   │           └── ThumbnailGrid.tsx
│       │   ├── dialogs/
│       │   │   ├── NewProjectDialog.tsx
│       │   │   ├── ApiSettingsDialog.tsx
│       │   │   ├── TaskQueueDialog.tsx
│       │   │   └── TemplateDialog.tsx
│       │   └── common/
│       │       ├── DarkButton.tsx
│       │       └── Banner.tsx
│       ├── hooks/
│       │   ├── useUndoRedo.ts            # 撤销/重做（栈式）
│       │   ├── useAutoSave.ts            # 2秒防抖自动保存
│       │   ├── useShortcuts.ts           # 快捷键
│       │   ├── useCopyPaste.ts           # Ctrl+C / Ctrl+V 节点
│       │   └── useTaskWS.ts              # 任务进度订阅
│       ├── utils/
│       │   ├── connectionRules.ts        # 连线规则校验
│       │   ├── upstreamWalker.ts         # Ctrl+点击全选上下游
│       │   ├── workflowSerializer.ts     # 工作流 JSON 序列化
│       │   └── nodeNaming.ts             # output_1, output_2... 唯一命名
│       └── styles/
│           └── tokens.css                # 颜色变量
└── backend/                     # FastAPI
    ├── pyproject.toml
    ├── requirements.txt
    ├── main.py                  # FastAPI 入口
    ├── config.py
    ├── routers/
    │   ├── projects.py          # 项目 CRUD
    │   ├── workflow.py          # 工作流保存/加载
    │   ├── tasks.py             # 任务提交/查询/取消
    │   ├── files.py             # 文件上传/缩略图/打开文件夹
    │   ├── settings.py          # API 密钥设置
    │   └── ws.py                # WebSocket 任务进度
    ├── services/
    │   ├── project_manager.py
    │   ├── task_queue.py        # 多线程/asyncio 队列管理
    │   ├── executor.py          # 工作流执行引擎（依赖追踪）
    │   ├── thumbnail.py         # OpenCV 提取首帧
    │   ├── image_compress.py    # 4.7MB 自动压缩
    │   ├── mask.py              # 蒙版图像处理
    │   └── crypto.py            # API 密钥加密
    ├── api_clients/
    │   ├── base.py
    │   ├── kling.py
    │   ├── jimeng.py            # 火山引擎 HMAC-SHA256
    │   ├── gemini.py
    │   ├── veo3.py
    │   ├── gpt_image.py
    │   ├── text_vision.py       # GPT-5.2 / Gemini-3 视觉
    │   └── seedance2.py         # 豆包 Seedance
    ├── models/
    │   ├── schemas.py           # Pydantic
    │   └── workflow.py          # 节点/边数据结构
    └── resources/
        ├── sm.txt               # 使用说明
        └── templates.json       # 工作流模板
```

---

## 4. 数据契约

### 4.1 工作流 JSON 格式（前后端共用）

```json
{
  "version": 2,
  "viewport": { "x": 0, "y": 0, "zoom": 1 },
  "nodes": [
    {
      "id": "node_1",
      "type": "image",
      "position": { "x": 100, "y": 200 },
      "data": {
        "image_path": "素材库/cat.png",
        "mask_path": null,
        "has_mask_output": false
      }
    },
    {
      "id": "node_2",
      "type": "kling",
      "position": { "x": 400, "y": 200 },
      "data": {
        "model": "kling-v3",
        "mode": "image2video",
        "duration": 5,
        "resolution": "1080p",
        "cfg_scale": 0.5,
        "prompt": "一只猫在跳舞"
      }
    },
    {
      "id": "node_3",
      "type": "output",
      "position": { "x": 700, "y": 200 },
      "data": {
        "name": "output_1",
        "media_type": "auto",
        "result_path": null,
        "thumbnail_path": null
      }
    }
  ],
  "edges": [
    { "id": "e1", "source": "node_1", "sourceHandle": "out", "target": "node_2", "targetHandle": "in_image" },
    { "id": "e2", "source": "node_2", "sourceHandle": "out", "target": "node_3", "targetHandle": "in" }
  ]
}
```

### 4.2 节点类型清单

| type | 名称 | 输入端口 | 输出端口 | 说明 |
|---|---|---|---|---|
| `image` | 图片上传 | — | `out`(图)、`mask`(可选) | 拖拽/选择本地图片，支持绘蒙版 |
| `video` | 视频上传 | — | `out`(视频) | 上传 mp4/mov/avi/mkv/wmv/flv/webm |
| `kling` | 可灵生视频 | `in_image` 或 `in_first/in_last` | `out`(视频) | 12 个模型；首尾帧由模型矩阵控制 |
| `jimeng` | 即梦生视频 | 同上 | `out`(视频) | jimeng_v1/v2/v30/v30_pro |
| `gemini` | 香蕉生图 | `in_refs`(多连，最多14) | `out`(图) | flash / 2.0-flash / 3-pro |
| `veo3` | Veo3 生视频 | `in_image` 或 `in_first/in_last` | `out`(视频) | veo_3_1 / veo3.1 / veo2 等 |
| `image_edit` | 图片修改 | `in_image` (+`in_mask` 仅局部重绘) | `out`(图) | 可灵扩图 / 即梦超清 / 即梦局部重绘 |
| `text_vision` | 文本视觉 | `in_image`(可多连) | `out`(文本) | GPT-5.2 / Gemini-3 |
| `text_display` | 文本展示 | `in_text` | — | 显示文本视觉结果 |
| `output` | 视频/图片输出 | `in` | `out`(链式传递) | 智能双模式；`output_N` 唯一命名 |

### 4.3 连线规则
- 输入口（input handle）：**最多 1 条边**（`gemini.in_refs` 例外，最多 14 条）
- 输出口（output handle）：**多连无限制**
- 类型校验：图 → 图、视 → 视、文 → 文（前端在 `onConnect` 拦截）
- 校验在 `frontend/src/utils/connectionRules.ts` 实现，与 ReactFlow 的 `isValidConnection` 联动

### 4.4 项目目录布局
```
{磁盘}:/AIVIDEO/{项目名}/
├── 素材库/                   # 上传的图片/视频
│   ├── cat.png
│   ├── cat_mask.png         # 蒙版（与原图同名 + _mask）
│   └── gemini_<ts>.png       # Gemini 生图自动落盘
├── workflow.json             # 当前工作流
├── workflows/                # 历史工作流备份
├── history.json              # 生成历史
├── output_1.mp4              # 输出节点产物
├── output_1_thumb.jpg
└── output_2.png
```

---

## 5. 后端 API 规范

所有接口前缀 `/api`，错误统一 `{ "ok": false, "error": "..." }`。

### 5.1 项目
| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/projects` | 列出 `*:/AIVIDEO/*` 下所有项目 |
| POST | `/api/projects` | 创建项目 `{ disk, name }` |
| DELETE | `/api/projects/{name}` | 仅从列表移除（不删本地文件） |
| GET | `/api/projects/{name}/workflow` | 加载 `workflow.json` |
| PUT | `/api/projects/{name}/workflow` | 保存 |

### 5.2 文件
| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/files/upload` | multipart/form-data，落地到当前项目 `素材库/` |
| GET | `/api/files/raw?path=...` | 返回原文件流（图/视频预览） |
| GET | `/api/files/thumbnail?path=...` | 视频取首帧 jpg；图片直接返回 |
| POST | `/api/files/open-folder` | 用 `explorer /select` 打开并选中 |
| POST | `/api/files/copy-image-clipboard` | 把图片写入 Windows 剪贴板 |
| POST | `/api/files/save-mask` | 保存蒙版 PNG 到 `素材库` |

### 5.3 任务
| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/tasks/run` | `{ project, workflow, output_node_ids[] }` 提交执行 |
| GET | `/api/tasks` | 列出当前队列 |
| POST | `/api/tasks/{id}/cancel` | 取消单个 |
| POST | `/api/tasks/cancel-all` | 全部取消 |
| POST | `/api/tasks/clear-finished` | 清理已完成 |
| WS | `/api/ws/tasks` | 实时进度推送 |

### 5.4 设置
| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/settings/api-keys` | 返回脱敏后的密钥列表 |
| PUT | `/api/settings/api-keys` | 加密保存 |
| POST | `/api/settings/test-connection` | `{ provider }` 测试连接 |
| GET | `/api/settings/help-text` | 返回 `resources/sm.txt` 内容 |
| GET | `/api/settings/templates` | 返回工作流模板列表 |

### 5.5 WebSocket 消息格式
```json
{ "type": "task_update", "task": { "id": "...", "name": "output_1", "kind": "kling", "status": "running", "progress": 60, "message": "生成中 60%" } }
{ "type": "task_log", "task_id": "...", "line": "..." }
{ "type": "task_done", "task_id": "...", "result_path": "...", "thumbnail_path": "..." }
{ "type": "task_failed", "task_id": "...", "error": "..." }
```

---

## 6. 前端关键实现要点

### 6.1 ReactFlow 自定义节点
- 每个节点用 `nodeTypes` 注册，根据 `data.type` 渲染对应组件
- Handle 配置：`<Handle type="target" position={Position.Left} id="in_image" />`
- Socket 颜色（CSS 变量）：
  - 输入图：`--socket-image: #4caf50`（绿）
  - 输入视频：`--socket-video: #2196f3`（蓝）
  - 输入文本：`--socket-text: #b0bec5`（灰）
  - 输入参考图（多连）：`--socket-refs: #ff9800`（橙）
  - 输出：与对应类型一致，但圆环加粗

### 6.2 连线校验
```ts
// connectionRules.ts
export function isValidConnection(conn: Connection, nodes, edges): boolean {
  const targetNode = nodes.find(n => n.id === conn.target);
  const targetHandle = conn.targetHandle;
  // 1. 输入口已被占用（橙色端口除外）
  const isOrange = targetNode.type === 'gemini' && targetHandle === 'in_refs';
  if (!isOrange) {
    if (edges.some(e => e.target === conn.target && e.targetHandle === targetHandle)) return false;
  } else {
    if (edges.filter(e => e.target === conn.target && e.targetHandle === 'in_refs').length >= 14) return false;
  }
  // 2. 类型校验
  return checkTypeCompat(conn);
}
```

### 6.3 自动保存
- `useAutoSave.ts`：监听 `nodes/edges/viewport` 变化，2 秒 debounce 后 `PUT /workflow`
- 拖入/删除/连线/粘贴等离散操作触发立即保存

### 6.4 撤销/重做
- 使用栈式实现：`history: WorkflowSnapshot[]`，`pointer: number`
- 每次结构性变化（节点增删/边增删/参数修改）push 一个深拷贝快照
- `Ctrl+Z`：pointer-- 并 `setNodes/setEdges`
- `Ctrl+Y`：pointer++

### 6.5 Ctrl+点击 全选连接
- 在 `useShortcuts.ts` 监听 mousedown + ctrlKey
- BFS 遍历 edges：从命中节点出发，向上游（`edge.source`）和下游（`edge.target`）扩散
- 调用 ReactFlow 的 `setNodes` 把命中节点 `selected: true`

### 6.6 模板放置（点击放置模式）
- 工具栏「📦 模板」打开 Modal，选择模板后关闭 Modal
- 进入 `placingTemplate` 状态：鼠标变 crosshair（CSS）
- 监听 `onPaneClick`：以模板左上角第一个节点的相对偏移计算所有节点位置 = `clickPos + (nodeOffset)`
- 不清空已有节点；新节点的 ID 全部重新生成；`output_N` 重新分配唯一名

### 6.7 复制粘贴
- `Ctrl+C`：复制选中节点 + 相关连线（仅当源/目标都在选中集合内）到 zustand `clipboard`
- `Ctrl+V`：以鼠标当前坐标为锚，保持相对位置粘贴；输出节点重命名为下一个 `output_N`；图片节点的 mask 数据一并复制

### 6.8 蒙版绘制
- `MaskEditor.tsx`：弹出全屏 Modal，内含两层 canvas（背景显示原图轮廓 + Sobel 边缘；前景接收笔刷）
- 左键涂抹（红 + alpha 0.5），右键擦除
- 滑块调画笔大小，按钮切橡皮擦
- 确认后 canvas → ImageData → POST `/api/files/save-mask`，得到 `cat_mask.png`
- 节点 `data.mask_path` 设值并新增 `mask` 输出 handle

### 6.9 视频播放
- 节点缩略图来自后端 `/api/files/thumbnail`
- 单击：在节点内挂载隐藏的 `<video>`，`play()`，再次点击 `pause()` 并 `currentTime=0` 恢复缩略图
- 双击：`window.open(file_url)` 或调后端 `/api/files/open-with-system`
- 拖拽视频缩略图到桌面/微信：使用 HTML5 `dragstart` + `e.dataTransfer.setData('DownloadURL', 'video/mp4:name.mp4:'+url)`（Chromium）

### 6.10 任务队列
- 顶部工具栏 `📋 队列(N)`，N = 运行中任务数
- WS 推送驱动 `taskStore`
- 队列 Modal 列：名称（输出节点名）、类型、状态、进度、操作（停止）
- 状态：`queued / running / done / failed / cancelled`
- 双击行 → 在画布定位并选中对应输出节点

---

## 7. 后端关键实现要点

### 7.1 任务执行引擎
- 每个 OutputNode 一个独立 asyncio Task
- 从 OutputNode 反向 BFS 收集依赖子图，按拓扑序执行
- 同一个 OutputNode 已在执行中则忽略重复提交
- 节点 cache：`(node_id, hash(inputs+params)) → output_path`，避免重跑

### 7.2 API 客户端
- `kling.py`：JWT 签名（HS256，ak/sk），轮询 `/v1/videos/image2video/{task_id}` 直到 `succeed`
- `jimeng.py`：火山引擎签名（content-type / host / x-date 三头 HMAC-SHA256），endpoint `CVSync2AsyncSubmitTask` / `CVSync2AsyncGetResult`，version `2022-08-31`
  - 错误码识别：`50400 Access Denied` → 提示开通服务；`AccessDenied` → 缺 `CVImageProcessFullAccess`
- `gemini.py`：`POST .../models/{model}:generateContent?key=...`，`inlineData.mimeType=image/png`，HTTP 429 重试 6 次（30s 起步），SSL/超时重试 6 次（5s 起步）
- `veo3.py`：向量引擎中转，`enhance_prompt` 中文转英文
- `text_vision.py`：GPT-5.2 / Gemini-3 视觉

### 7.3 图片压缩
- 在每次发起 API 前检查输入图片大小
- > 4.7MB 自动转 JPEG，质量从 95 递减直到达标；RGBA → RGB

### 7.4 配置加密
- 首次启动生成 Fernet key，存 `%APPDATA%/pic_video_0515/secret.key`（权限受限）
- 密钥读写都通过 `crypto.encrypt/decrypt`

### 7.5 单实例
- Electron `app.requestSingleInstanceLock()`；后端进程被 Electron 主进程托管
- 仅 PyWebView 模式下后端用 `socket.bind(('127.0.0.1', SHARED_PORT))` 抢锁

---

## 8. UI 视觉规范

| 元素 | 值 |
|---|---|
| 背景色 | `#1a1a1a` |
| 画布网格 | `#222` 点状，10px |
| 节点头部 | 类型主色 + 渐变 `linear-gradient(135deg, #2d2d2d, #1f1f1f)` |
| 节点边框 | 默认 `#3a3a3a`；选中 `#4fc3f7`；执行中流光（CSS animation） |
| 文字 | `#e0e0e0` |
| 字体 | `Microsoft YaHei, Segoe UI, sans-serif` |
| 圆角 | 节点 8px，按钮 4px |
| 工具栏 | 顶部 48px，磨砂玻璃 `backdrop-filter: blur(8px)` |
| 帮助面板 | 右侧 200px，`sm.txt` 行号自动编号；可在设置→通用关闭 |

执行状态横幅（顶部插入）：
- 蓝：执行中
- 绿：成功
- 红：失败（带错误 message）

---

## 9. 快捷键（与原版一致）

| 快捷键 | 功能 |
|---|---|
| Ctrl+Z | 撤销 |
| Ctrl+Y | 重做 |
| Ctrl+C | 复制选中节点（含内部连线） |
| Ctrl+V | 粘贴到鼠标位置 |
| Delete | 删除选中节点/连线 |
| Ctrl+S | 立即保存工作流 |
| Ctrl+点击 | 全选连接的所有上下游节点 |
| 鼠标滚轮 | 缩放画布（向上放大） |
| 鼠标中键拖拽 | 平移画布 |

---

## 10. 模型与参数矩阵（直接抄给前端的 select 用）

### 10.1 可灵
- 模型：`kling-v3-omni / kling-v3 / kling-video-o1 / kling-v2-6 / kling-v2-5-turbo / kling-v2-master / kling-v2-1-master / kling-v2-1 / kling-v2 / kling-v1-6 / kling-v1-5 / kling-v1`
- 时长：v3 / v3-omni 支持 3–15s；其他 5/10s
- 分辨率：720p (std) / 1080p (pro)
- CFG：0.0–1.0（默认 0.5）
- 首尾帧支持矩阵（与 testdir/PLAN.md 完全一致，前端用 `klingMatrix.ts` 静态查表）

### 10.2 即梦
- 模型：`jimeng_v1 / jimeng_v2 / jimeng_v30 / jimeng_v30_pro`
- 时长：5/10s；帧率 24fps
- Seed：-1（随机）~ 2147483647
- jimeng_v30_pro 仅图生视频；jimeng_v30 首尾帧 `req_key=jimeng_i2v_first_tail_v30`

### 10.3 Gemini（香蕉）
- 模型：`gemini-2.5-flash-preview-image-generation / gemini-2.0-flash-preview-image-generation / gemini-3-pro-image-preview`
- 宽高比：1:1 / 2:3 / 3:2 / 3:4 / 4:3 / 4:5 / 5:4 / 9:16 / 16:9 / 21:9
- 分辨率（仅 Pro）：1024 / 2048 / 4096，默认 2048
- 参考图：0–14（动态 handle 数）

### 10.4 Veo3
- 模型：`veo_3_1（默认） / veo3.1 / veo3.1-fast / veo3.1-pro / veo3.1-4k / veo3.1-pro-4k / veo3-pro / veo3-fast / veo3-fast-frames / veo3-frames / veo3-pro-frames / veo2-pro / veo2-fast / veo2-fast-frames / veo2-fast-components / veo2-pro-components`
- 宽高比：16:9 / 9:16
- enhance_prompt（中→英）、enable_upsample（超分）

### 10.5 文本视觉
- 模型：`gpt-5.2-vision / gemini-3-vision`
- temperature：0.0–2.0，默认 0.7

### 10.6 图片修改（ImageEditNode）
- 模式：`kling_expand / jimeng_super / jimeng_inpaint`
- kling_expand：上/下/左/右 0–2.0，提示词可选，单图输入；总扩展面积 ≤3 倍
- jimeng_super：分辨率 4k/8k，锐化 0–100，单图输入
- jimeng_inpaint：seed、提示词（≤120 字符），原图+蒙版双输入

---

## 11. 工作流模板（`backend/resources/templates.json`）

```json
[
  {
    "id": "basic_i2v",
    "name": "基础图生视频",
    "nodes": [
      {"id":"n1","type":"image","position":{"x":0,"y":0},"data":{}},
      {"id":"n2","type":"kling","position":{"x":300,"y":0},"data":{"model":"kling-v3","mode":"image2video","duration":5,"resolution":"1080p"}},
      {"id":"n3","type":"output","position":{"x":600,"y":0},"data":{"name":"output_1"}}
    ],
    "edges": [
      {"source":"n1","sourceHandle":"out","target":"n2","targetHandle":"in_image"},
      {"source":"n2","sourceHandle":"out","target":"n3","targetHandle":"in"}
    ]
  },
  { "id": "first_last_frame", "name": "首尾帧过渡", "..." },
  { "id": "dual_compare", "name": "双模型对比", "..." }
]
```

---

## 12. 启动与构建

### 12.1 开发模式
```bash
# 终端 1：后端
cd backend
pip install -r requirements.txt
uvicorn main:app --port 18765 --reload

# 终端 2：前端
cd frontend
npm install
npm run dev   # http://localhost:5173

# 终端 3：Electron 壳（开发态指向 5173）
npm run electron:dev
```

### 12.2 生产打包
```bash
cd frontend && npm run build       # → frontend/dist
cd ../backend && pyinstaller backend.spec  # → backend/dist/backend.exe
cd .. && npm run electron:build    # 把 frontend/dist + backend/dist/backend.exe 打进 NSIS 安装包
```

---

## 13. 验收清单（与 testdir 功能 1:1 对齐）

- [ ] 单实例锁
- [ ] 项目列表 / 新建（深色对话框） / 进入编辑器 / 删除（仅移除）
- [ ] 同一时间只能开一个项目编辑器
- [ ] 拖拽创建节点；从文件管理器拖图/视频自动建节点
- [ ] 输入口单连，输出口多连，橙色 14 连
- [ ] Ctrl+C/V、Ctrl+Z/Y、Delete、Ctrl+S、Ctrl+点击全选连通图、滚轮缩放、中键平移
- [ ] 自动保存（离散操作即时 + 2s debounce）
- [ ] 模板点击放置（不清空、左上角对齐鼠标）
- [ ] 输出节点 `output_N` 唯一命名（拖入/粘贴/模板均不重复）
- [ ] 智能双模式输出（PNG/MP4 自动判定）
- [ ] OutputNode 有输出端口，可链式执行
- [ ] OutputNode 右键 → 复制路径 → Ctrl+V 自动建 Image/Video 上传节点
- [ ] 蒙版绘制（红色高亮 / 右键擦除 / 笔刷 / 橡皮擦 / 第二输出口）
- [ ] 图片自动压缩 ≤4.7MB
- [ ] 视频缩略图 + 节点内播放 / 双击系统播放器
- [ ] 拖拽视频缩略图到资源管理器/微信
- [ ] 任务队列 Modal（停止单个 / 全部停止 / 清除已完成）
- [ ] 工具栏「📋 队列(N)」 + 状态栏完成提示
- [ ] 多输出节点并行执行
- [ ] API 设置（可灵 ak/sk、即梦 ak/sk、Gemini key + 中转 BASE_URL、Veo3 key、GPT-5.2 key、Gemini-3 key），加密存储，测试连接
- [ ] 即梦 50400 / AccessDenied / SignatureDoesNotMatch 错误识别
- [ ] Gemini 429 / SSL 自动重试
- [ ] Veo3 中文 → 英文 enhance_prompt
- [ ] 右侧使用说明面板（200px，行号，可关闭）
- [ ] 执行状态横幅（蓝/绿/红）
- [ ] 防重复执行
- [ ] 历史面板（参数 + 重新加载）

---

## 14. 实施顺序建议

1. **后端骨架**：FastAPI + 项目 CRUD + 文件上传 + WebSocket 占位
2. **前端骨架**：Vite + ReactFlow + 深色主题 + 项目列表页
3. **节点编辑器**：自定义 9 类节点 + 连线规则 + 自动保存
4. **快捷键体系**：撤销/重做、复制粘贴、Ctrl+点击、Delete、缩放、平移
5. **执行引擎**：单 OutputNode 端到端打通可灵图生视频
6. **多 API 接入**：即梦 / Gemini / Veo3 / 文本视觉 / 图片修改
7. **高级功能**：蒙版绘制、模板、任务队列 UI、链式执行
8. **打包**：Electron + PyInstaller + NSIS

---

**版本**：0.1（设计稿）
**日期**：2026-05-15
