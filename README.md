# BU 蓝昊 · pic_video_0515

> 基于 [`testdir/`](../testdir) 的 PyQt5 节点编辑器，前端用 **ReactFlow** 重做。  
> 后端继续是 **Python (FastAPI)**，桌面壳是 **Electron**。  
> 设计稿见 [`DESIGN.md`](DESIGN.md)。

## 节点（12 类）

| type | 输入 | 输出 |
|---|---|---|
| image | — | out（图）+ mask（绘制后） |
| video | — | out（视频） |
| audio | — | out（音频） |
| kling | in_image / in_first+in_last | out（视频） |
| jimeng | 同上 | out（视频） |
| veo3 | 同上 | out（视频） |
| seedance2 | in_images(9)+in_videos(3)+in_audios(3) / in_image / in_first+in_last | out（视频） |
| gemini | in_refs（最多 14 张） | out（图） |
| image_edit | in_image (+in_mask 仅局部重绘) | out（图） |
| text_vision | in_image（多连） | out（文本） |
| text_display | in_text | out（文本） |
| output | in（任意） | out（链式） |

每类节点的参数与 testdir 完全对齐，包括动态联动（kling 模型 → 时长选项；jimeng 模型 → 分辨率显示；首尾帧能力矩阵；text_vision 思考等级随模型变；image_edit 三种模式的不同字段；seedance2 三种模式的不同输入端口）。

## 启动

```powershell
cd E:\LHX\AI\pic_video_0515
.\dev.bat                 # 同时起前后端
# 或：
npm install
npm run dev:backend       # 后端 :18765
npm run dev:frontend      # 前端 :5173
npm run dev:electron      # 桌面壳
```

打包：

```powershell
npm install
cd backend && pip install -r requirements.txt && cd ..
npm run build             # 出 NSIS 安装包
```

## 鼠标 / 键盘交互（与 testdir 一致）

- **拖入素材**：从节点面板拖类型；从资源管理器拖图片/视频/音频
- **画布右键**：快速添加节点（按组分类）
- **节点右键**：图片节点（打开文件夹/复制图片/绘制蒙版）；视频与输出节点（系统播放器/文件夹）；输出节点（执行/复制 TAPNOW 路径）；文本显示（复制/执行）
- **缩略图**：单击在节点内播放/暂停；双击系统播放器打开；可拖到资源管理器/微信
- **参考图缩略图条**：拖拽改变顺序，存储到 `ref_order_<handle>`
- **连线**：左键按住 socket 拖到目标，类型不符或占满会被拒绝
- **快捷键**：Ctrl+Z/Y/A/C/V/S、Delete、方向键、Ctrl+点击全选连通图、滚轮缩放、中键/右键平移
- **粘贴 TAPNOW 路径**：剪贴板里有 `TAPNOW_IMG:` / `TAPNOW_VID:` 时，Ctrl+V 自动建对应类型节点

## 工具栏

返回 / 保存 / 撤销 / 重做 / 模板 / 历史 / 队列(N) / 执行 / 停止全部 / 切换说明面板 / API 设置

## API 设置（含通用设置）

| 提供商 | 字段 |
|---|---|
| 可灵 AI | access_key / secret_key |
| 即梦 AI | access_key / secret_key |
| 香蕉 (Gemini) | api_key + base_url(可空) |
| Veo3 视频 | api_key |
| Seedance 2.0 | api_key |
| GPT-5.4 | api_key + base_url(可空) |
| Gemini-3.1 Pro | api_key + base_url(可空) |
| 通用设置 | 默认保存磁盘 / 是否显示右侧说明面板 |

密钥用 Fernet 加密保存到 `%APPDATA%\pic_video_0515\settings.enc`。

## 状态

- ✅ 12 类节点（图片/视频/音频/可灵/即梦/Veo3/Seedance/Gemini/图片修改/文本视觉/文本显示/输出）
- ✅ 节点参数与 testdir 完全对齐（含动态联动）
- ✅ 全部鼠标/键盘交互
- ✅ 蒙版绘制、参考图排序、链式执行
- ✅ 任务队列、生成历史、状态横幅
- ✅ 桌面壳（Electron + 后端 spawn + 单实例）
- ✅ Seedance2 三种模式已按 testdir 契约提交 data URL，不再把本地路径直接发给远端 API
