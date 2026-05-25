# 第7轮 - UI细节打磨与交互动效深化

## 一、CSS变量体系（全局色板）
在 `global.css` 顶部新增完整 CSS 变量体系，包含：
- 主色调（primary/secondary/accent）
- 语义色（success/error/warning）
- 节点类型色（image/video/audio/text/output/kling/jimeng/gemini/veo3/seedance/storyboard/edit）
- 表面/背景色（surface/elevated/overlay/input）
- 文字层级（primary/secondary/tertiary/link）
- 边框、圆角、阴影、过渡、字体大小等
- 所有组件引用 CSS 变量，实现统一暗色主题

## 二、节点细节优化
### 1. 标题栏渐变底色
- `NodeShell.tsx` 新增 `variant` 属性，支持 13 种节点类型
- `global.css` 新增 `.node-title-bar-*` 渐变样式（按类型不同颜色）
- 所有节点组件已更新 `variant` 属性

### 2. 输入输出端口类型图标
- 在 `global.css` 中新增 `handle-icon-*::after` 伪元素图标
- 支持图片（🖼）、视频（🎬）、音频（🎵）、文本（📝）、引用（🔗）、蒙版（🎭）、分镜（📋）等图标

### 3. 节点内部间距和排版优化
- `.node-row` 使用 CSS 变量背景和边框
- `.node-label` 使用 `var(--text-secondary)` 颜色
- `.node-thumb` 使用 CSS 变量阴影和边框

### 4. 节点最小宽度统一、圆角统一
- `.node-shell` 使用 `var(--radius-md)` 统一圆角
- 保持 `min-width: 240px` 不变

### 5. 节点阴影层次
- 使用 `var(--shadow-lg)` 多层阴影
- 选中状态添加脉冲边框动画

## 三、交互动效
### 1. 连线 hover 加粗+发光
- `.react-flow__edge:hover .react-flow__edge-path` 加粗到 3px
- 添加 `drop-shadow` 发光效果

### 2. 节点选中时边框脉冲
- `.node-shell.selected::after` 添加 2px 边框脉冲动画
- 使用 `@keyframes selectPulse` 实现缩放+透明度变化

### 3. 拖拽节点时其他节点轻微淡出
- `FlowCanvas.tsx` 添加 `isDragging` 状态
- 拖拽时添加 `.dragging` class
- `.flow-canvas.dragging .react-flow__node:not(.dragging)` 透明度 0.45

### 4. 迷你地图添加缩放动画
- `.react-flow__minimap:hover` 添加 `transform: scale(1.05)`
- 使用 CSS 变量过渡

### 5. 面板切换使用 slide+fade 过渡
- 新增 `.panel-transition`、`.panel-slide-left-*`、`.panel-fade-*` 过渡类

## 四、配色体系统一
### 1. 定义 CSS 变量体系
- 见第一点，完整色板覆盖所有组件

### 2. 所有组件引用 CSS 变量
- 节点、手柄、背景、边框、文字等全部使用变量

### 3. 统一暗色主题色板
- 表面色：`#1e1e2e`、`#252536`、`#2a2a3c`
- 文字色：`#e8e8ed`、`#b0b0be`、`#787890`

## 五、字体和排版
### 1. 统一字体大小层级
- `--font-xs` 到 `--font-2xl` 6 个层级
- 代码字体使用 `'Cascadia Code', 'Fira Code', 'Consolas', monospace`

### 2. 优化代码块样式
- `pre` 和 `code` 使用 CSS 变量背景和边框
- 添加左侧彩色边框

### 3. 统一输入框/按钮/下拉框样式
- 统一背景、边框、聚焦状态
- 按钮使用渐变背景和悬停动画

## 六、空状态和加载态
### 1. 统一 Loading 骨架屏动画
- `.skeleton` 使用渐变背景动画
- `.skeleton-text`、`.skeleton-circle`、`.skeleton-rect` 三种形态

### 2. 空状态占位图+引导文字
- `.empty-state` 居中布局
- `.empty-state-icon` 大图标
- `.empty-state-title`、`.empty-state-desc` 引导文字

### 3. 错误状态友好提示
- `.error-state` 红色渐变背景
- `.error-state-icon` 错误图标
- `.error-state-action` 操作按钮区域

## 七、响应式断点
新增三个断点：
- `1200px`：侧边栏 200px
- `900px`：隐藏右侧面板
- `600px`：移动端单列布局

## 八、修复的 TypeScript 错误
修复 5 个节点组件的语法错误：
- `GeminiNode.tsx`：移除多余的 `)`
- `KlingNode.tsx`：移除多余的 `)`
- `TextVisionNode.tsx`：移除多余的 `)`
- `ImageNode.tsx`：补全 `export default`
- `StoryboardNode.tsx`：补全 `export default`

## 九、文件路径
- 主要修改：`frontend/src/styles/global.css`（+500 行）
- 节点组件：13 个文件添加 `variant` 属性
- 画布交互：`FlowCanvas.tsx` 添加拖拽状态
- 文档：`docs/ui_round7_summary.md`

## 十、视觉效果提升
1. **节点层次感**：标题栏渐变 + 状态指示灯 + 进度徽章
2. **交互反馈**：拖拽淡出 + 连线发光 + 选中脉冲
3. **视觉一致性**：全站使用 CSS 变量，统一暗色赛博主题
4. **响应式体验**：三个断点适配不同设备
5. **状态完整性**：加载/空/错误状态统一设计

所有修改已应用，TypeScript 编译通过（除预存在 AudioNode/DataFlowEdge 的遗留错误）。