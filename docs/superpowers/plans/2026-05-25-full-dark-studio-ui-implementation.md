# Full Dark Studio UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不改变现有前端功能路径和后端接口契约的前提下，实现统一的 full dark studio 项目页与编辑器界面，并为运行中的节点增加克制的浅白色边缘流光效果。

**Architecture:** 先收敛全局主题令牌与共用壳层，再分别实现项目页与编辑器控制台，最后把节点外壳和运行态视觉绑定到现有 NodeShell / task status 系统。整个实现坚持小步提交，每个 phase 通过 scoped validation 后立即 commit、push，并更新对应 Linear task 状态。

**Tech Stack:** React 18, TypeScript, Vite, Ant Design 5, ReactFlow, Zustand, Electron shell

---

当前仓库没有独立的前端测试框架。本轮视觉重构不新增测试框架，验证手段固定为：

- `cd frontend && npm run build`
- 受影响文件的编辑器静态错误检查
- 项目页、编辑器页、运行中节点效果的 focused runtime validation

执行本计划前的 workflow 约束：

- 先把本计划按 task 级别同步到 Linear。
- 每个 `### Task` 都作为独立的 Linear task 执行。
- 开始某个 task 时把该 task 切到 `In Progress`。
- 该 task 的 scoped validation 通过后，立即 commit、push，并把该 task 切到 `Done`。
- 不把多个 phase 的验证、状态更新或推送堆到最后一次性处理。

运行态定义在本计划中固定为：

- `executing`: 显示浅白色边缘流光动画。
- `queued`: 允许显示更弱的静态边缘提亮，但不显示流动动画。
- `idle`, `success`, `error`, `cancelled`: 不显示流光动画。

## Phase 1 - Dark System Foundation

### Task 1 - Establish theme tokens and shared shell primitives

**Files:**
- Modify: `frontend/src/main.tsx`
- Modify: `frontend/src/styles/global.css`
- Validation: `frontend/package.json`

- [ ] **Step 1: Start the phase task and verify the workspace is clean**

Run: `git status --short`
Expected: no unrelated frontend changes before phase work starts.

- [ ] **Step 2: Replace the Ant Design root theme tokens in `frontend/src/main.tsx`**

Set `ConfigProvider` tokens to the full dark studio palette so base containers, text, border radius, and primary accent all align with the approved dark system instead of the current generic dark preset.

- [ ] **Step 3: Rewrite the root CSS variables in `frontend/src/styles/global.css`**

Create one coherent token set for page background, panel surfaces, node surfaces, border colors, primary text, secondary text, accents, and state colors. Remove the current GitHub-like dark token bias and reduce purple-heavy neon styling.

- [ ] **Step 4: Rework shared shell primitives in `frontend/src/styles/global.css`**

Update `html`, `body`, `#root`, editor shell containers, shared panel surfaces, shared button surfaces, and background grid helpers so project page and editor page can sit on the same dark system.

- [ ] **Step 5: Run the focused build validation for the theme foundation**

Run: `cd frontend && npm run build`
Expected: successful TypeScript compile and Vite build.

- [ ] **Step 6: Commit and push the phase foundation slice**

Run: `git add frontend/src/main.tsx frontend/src/styles/global.css && git commit -m "feat(PICVIDE-8): establish full dark studio theme" && git push origin main`
Expected: commit and push succeed immediately after the scoped validation.

## Phase 2 - Project Index Dark Surface

### Task 1 - Convert the project page from inline dark list to full dark studio index

**Files:**
- Modify: `frontend/src/pages/ProjectListPage.tsx`
- Modify: `frontend/src/styles/global.css`
- Validation: `frontend/package.json`

- [ ] **Step 1: Move the project page structure off the current inline style shell**

Replace the top-level inline layout in `frontend/src/pages/ProjectListPage.tsx` with semantic wrapper elements and class names for a dark hero area, header actions, project card grid, and empty state shell.

- [ ] **Step 2: Preserve existing project behaviors while changing only the visual hierarchy**

Keep `新建项目`、`打开 AIVIDEO`、`API 设置`、右键菜单、项目打开、移除项目 and modal behavior unchanged. Do not change project data loading or action handlers.

- [ ] **Step 3: Add the full dark studio project-page styles to `frontend/src/styles/global.css`**

Implement the page background, hero surface, project cards, empty state treatment, helper text hierarchy, and action button layers so the project page matches the editor’s dark system.

- [ ] **Step 4: Validate the project page slice with a build**

Run: `cd frontend && npm run build`
Expected: build succeeds after the page structure and style refactor.

- [ ] **Step 5: Commit and push the project page phase slice**

Run: `git add frontend/src/pages/ProjectListPage.tsx frontend/src/styles/global.css && git commit -m "feat(PICVIDE-8): restyle project index in dark studio mode" && git push origin main`
Expected: push succeeds before moving to editor-shell work.

## Phase 3 - Editor Shell Controls

### Task 1 - Rebuild the toolbar as a dark studio control bar

**Files:**
- Modify: `frontend/src/components/flow/Toolbar.tsx`
- Modify: `frontend/src/components/effects/NeonButton.tsx`
- Modify: `frontend/src/components/effects/NeonButton.css`
- Modify: `frontend/src/styles/global.css`
- Validation: `frontend/package.json`

- [ ] **Step 1: Reduce the current mixed button language in `Toolbar.tsx`**

Keep the same actions and mobile menu behavior, but normalize button grouping, label density, and action hierarchy so primary actions feel intentional and secondary actions stop looking like a default admin toolbar.

- [ ] **Step 2: Refactor `NeonButton` into a restrained dark-studio action button**

Keep the reusable component boundary, but replace the strong neon pulse styling in `NeonButton.css` with darker surfaces, lower-saturation accent borders, and a more premium hover treatment.

- [ ] **Step 3: Add toolbar-specific surfaces and spacing rules to `frontend/src/styles/global.css`**

Style the toolbar as a floating control strip with unified spacing, dark translucent surfaces, and stable mobile collapse behavior.

- [ ] **Step 4: Run the focused build validation for the toolbar slice**

Run: `cd frontend && npm run build`
Expected: build succeeds and toolbar-related TypeScript changes compile cleanly.

- [ ] **Step 5: Commit and push the toolbar slice**

Run: `git add frontend/src/components/flow/Toolbar.tsx frontend/src/components/effects/NeonButton.tsx frontend/src/components/effects/NeonButton.css frontend/src/styles/global.css && git commit -m "feat(PICVIDE-8): restyle editor toolbar controls" && git push origin main`
Expected: push succeeds before status/banner adjustments begin.

### Task 2 - Convert the editor banner, canvas chrome, and shell surfaces into embedded dark panels

**Files:**
- Modify: `frontend/src/pages/EditorPage.tsx`
- Modify: `frontend/src/components/flow/StatusBanner.tsx`
- Modify: `frontend/src/components/flow/ParticleBackground.tsx`
- Modify: `frontend/src/components/flow/FlowCanvas.tsx`
- Modify: `frontend/src/styles/global.css`
- Validation: `frontend/package.json`

- [ ] **Step 1: Update `EditorPage.tsx` shell wrappers only where structure is needed for styling**

Keep the current three-column editor layout, task dialogs, and workflow loading logic intact. Only add or adjust wrapper classes needed to support the new dark shell surfaces.

- [ ] **Step 2: Rewrite `StatusBanner.tsx` as an embedded status surface**

Keep the existing status conditions, but render them inside a more controlled dark card / capsule treatment instead of a blunt high-contrast banner line.

- [ ] **Step 3: Add the editor shell and banner styling to `frontend/src/styles/global.css`**

Style left panel, center canvas frame, right help panel, and banner surfaces as one dark product system with consistent border, blur, and spacing rules.

- [ ] **Step 4: Recolor the background atmosphere and ReactFlow chrome to the dark system**

Update `frontend/src/components/flow/ParticleBackground.tsx` and `frontend/src/components/flow/FlowCanvas.tsx` so background particles, grid, controls, minimap, and other canvas chrome stop using the current light / blue-purple bias and instead match the approved dark studio palette.

- [ ] **Step 5: Run the focused build validation for the editor shell slice**

Run: `cd frontend && npm run build`
Expected: build succeeds after the editor-shell component updates.

- [ ] **Step 6: Commit and push the editor shell slice**

Run: `git add frontend/src/pages/EditorPage.tsx frontend/src/components/flow/StatusBanner.tsx frontend/src/components/flow/ParticleBackground.tsx frontend/src/components/flow/FlowCanvas.tsx frontend/src/styles/global.css && git commit -m "feat(PICVIDE-8): refine editor shell and canvas chrome" && git push origin main`
Expected: push succeeds before node-shell work starts.

## Phase 4 - Node Shell And Running Edge Glow

### Task 1 - Restyle NodeShell into the final dark node system

**Files:**
- Modify: `frontend/src/components/flow/nodes/shared/NodeShell.tsx`
- Modify: `frontend/src/styles/global.css`
- Validation: `frontend/package.json`

- [ ] **Step 1: Keep `NodeShell.tsx` as the single owner of node-state visual mapping**

Do not spread running-state style logic into individual node components. Preserve the current store-driven status lookup in `NodeShell.tsx` and change only the visual output and state class usage needed for the new design.

- [ ] **Step 2: Replace the current node surface classes with the final dark node treatments**

Update `frontend/src/styles/global.css` so node title, content surface, tags, selected state, error state, success state, and queued/executing state all match the approved dark-node direction.

- [ ] **Step 3: Implement the running-edge state mapping explicitly**

Apply the pale-white flowing edge animation only when `status === 'executing'`. Apply only a weaker non-animated rim for `queued`. Keep `success`, `error`, `idle`, and `cancelled` free of the moving border effect.

- [ ] **Step 4: Keep the high-performance fallback lightweight**

Preserve the existing high-node-count safeguard in `NodeShell.tsx` so the new edge glow can degrade gracefully when the canvas gets large.

- [ ] **Step 5: Run the focused build validation for the node-shell slice**

Run: `cd frontend && npm run build`
Expected: build succeeds after NodeShell and CSS state updates.

- [ ] **Step 6: Commit and push the node-shell slice**

Run: `git add frontend/src/components/flow/nodes/shared/NodeShell.tsx frontend/src/styles/global.css && git commit -m "feat(PICVIDE-8): add dark node shell and running edge glow" && git push origin main`
Expected: push succeeds before final runtime verification.

### Task 2 - Run focused runtime validation for the approved states

**Files:**
- Modify: none expected
- Validation: `package.json`, `frontend/package.json`

- [ ] **Step 1: Start the local runtime needed for the UI check**

Run in separate terminals:

- `cd backend && python main.py`
- `cd frontend && npm run dev`

Use the existing app entry path to load the UI in browser or Electron.

- [ ] **Step 2: Validate the dark project page behavior**

Open the project page and verify:

- page stays fully dark
- project cards remain clickable
- `API 设置` and `打开 AIVIDEO` remain accessible
- empty or populated states still read correctly

- [ ] **Step 3: Validate the editor shell behavior**

Open any project and verify:

- toolbar actions are visible and readable
- status banner renders as an embedded surface
- left and right panels remain usable
- canvas remains readable on the new background
- narrow-width layout still keeps the toolbar and panels usable

- [ ] **Step 4: Validate the node running-state behavior**

Trigger any workflow execution and verify:

- currently executing node shows a subtle pale-white flowing edge highlight
- queued nodes do not use the same moving edge animation
- success and error nodes remain distinguishable without the moving glow
- the glow effect does not wash the full node surface to a light card

- [ ] **Step 5: Re-run the frontend build after the runtime pass**

Run: `cd frontend && npm run build`
Expected: final build still succeeds after any runtime polish adjustments.

- [ ] **Step 6: Only if runtime polish changes are needed, commit and push that follow-up fix immediately**

Run only if Step 2-5 reveals a real UI defect that requires code changes: `git add frontend && git commit -m "fix(PICVIDE-8): polish final dark studio UI validation findings" && git push origin main`
Expected: if no code changed during runtime validation, skip this step and close the task with the already-pushed phase commits.