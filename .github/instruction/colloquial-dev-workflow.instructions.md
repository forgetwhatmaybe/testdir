---
description: "Use when the user informally manages development workflow or plan syncing in Chinese or English, including phrases like 开始做, 我来做, 继续做, 暂停, 卡住了, 做完了, 提测, 发 PR, 合并, 帮我起个分支, 同步到 Linear, 按 session 建 todo, 按 phase 建 todo, 把这个 Markdown 计划拆成任务, 把每个 session 里的任务创建出来, start working on, pick up, blocked, ready for review, sync this plan to Linear, or merge. Convert casual workflow language and Markdown session or phase plans into explicit Linear and GitHub development actions."
---

# Portable Config

For most projects, this is the only project-scoped file you need to copy.
When you move this workflow to another repository, update the `project` block and optionally the `workflow` block below.

project:
  name: "节点视频工具"
  team: "PICVIDE"
  repo: "https://github.com/forgetwhatmaybe/testdir.git"

workflow:
  stateAliases:
    active: ["In Progress", "Started", "Doing"]
    blocked: ["Blocked", "On Hold", "Paused"]
    review: ["In Review", "Review"]
    done: ["Done", "Completed", "Merged"]
  planSync:
    defaultMode: "tasks-within-sessions"
    fallbackMode: "task"
    splitThreshold: 20
    reuseExisting: true
    includeCompleted: false
    containerAliases: ["Session", "Phase", "阶段"]
    taskAliases: ["Task", "任务", "Todo", "Step"]
    titleFormat: "[{plan}] {container} / {task}"

# Config Notes

- `project.team` must be the Linear team key, for example `TEST` or `LHX`, not a personal API token.
- Keep Linear authentication in `.vscode/mcp.json` by using `${input:linear-api-key}` or another secret source.
- If a workspace `.vscode/mcp.json` or user-profile `mcp.json` exists and contains a Linear server or Linear API credentials, use that configuration as the primary authentication source for Linear API access.
- If you move this rule to another workspace, update `project.name`, `project.team`, and `project.repo` first.
- If Linear MCP is already configured globally in VS Code, other projects usually only need this instruction file.
- `project.repo` is optional. Leave it blank or use a placeholder when you only need Linear workflow actions.
- `workflow.stateAliases` is the first place to adapt when another Linear workspace uses different status names.
- `workflow.planSync.containerAliases` defines which container headings behave like sessions.
- `workflow.planSync.taskAliases` defines which subheadings become individual Linear tasks.
- `workflow.planSync.titleFormat` should stay stable across re-syncs so issue titles remain easy to match and update.
- Default import behavior is task-first: create one Linear issue per task inside each session or phase, not one issue per session by default.
- Preferred Linear connection order is: `mcp.json` credentials -> direct Linear API / MCP / skill path -> browser login fallback.
- When the project does not explicitly standardize on English, prefer Chinese for user-facing UI copy, README explanations, command annotations, code comments, and workflow summaries. Keep library names, APIs, and required protocol keywords in their original language.
- Keep `README.md` updated with Chinese command descriptions and explicit backend/frontend run commands whenever the runtime flow changes.

# Copy To Another Project

1. Copy this file to `.github/instructions/colloquial-dev-workflow.instructions.md` in the target repository.
2. Update `project.name`, `project.team`, and optionally `project.repo`.
3. Adjust `workflow.stateAliases` only if that team's Linear state names differ.
4. Keep Linear authentication outside this file, ideally in a user-level MCP configuration, so you do not need a per-project secret file.

# Stable Markdown Plan Format

Prefer this structure when you want deterministic imports into Linear:

```md
# Plan Title

## Session 1 - Foundation

Short session summary.

### Task 1 - Backend Health Slice
- [ ] Write the failing backend test
- [ ] Run the backend test and verify it fails

### Task 2 - Frontend Shell Slice
- [ ] Write the failing frontend test
- [ ] Run the frontend test and verify it fails

## Session 2 - Runtime Baseline

Short session summary.

### Task 1 - Runtime files
- [ ] Add the minimum runtime files
```

Stability rules for plan files:

- Use one top-level plan title.
- Prefer `## Session N - Name`. `## Phase N - Name` is also supported.
- Use `### Task N - Name` for sub-work items.
- Keep session or phase titles unique within the file.
- Prefer unchecked checklists for actionable todos.
- Avoid renaming the same session or phase repeatedly after it has been synced once, because title stability improves re-sync matching.

# Recommended Phrases

Prefer short intent-first messages. These examples are recommended because they are easy to match reliably.

Start or resume:

- `开始做 TEST-123 登录系统`
- `继续做报表导出，按 Linear 流程处理`
- `pick up TEST-123`

Pause or blocked:

- `这个任务卡住了，帮我更新 Linear 状态`
- `先暂停 TEST-123`
- `I am blocked on TEST-123`

Ready for review or PR:

- `TEST-123 做完了，帮我走提测流程`
- `帮我准备发 PR，按 Linear 流程处理`
- `TEST-123 ready for review`

Done or merged:

- `这个功能已经合并了，更新 Linear`
- `TEST-123 done`

Plan sync:

- `把这个 Markdown 计划同步到 Linear，把每个 session 里的任务都创建出来`
- `把这个 Markdown 计划同步到 Linear，按 session 下的任务建 todo`
- `把当前打开的 Markdown 计划同步到 Linear`
- `把 docs/superpowers/plans/2026-05-21-phase-1-foundation.md 同步成 Linear todo`
- `只同步 Session 1 到 Linear`
- `把这份计划拆成多个 Linear todo`
- `把当前文件按默认规则同步到 Linear`
- `重同步这个计划到 Linear，尽量复用已有 todo`

# Goal

When the user uses everyday language to manage development work, interpret it as workflow intent instead of casual chat.

# Core Rules

1. Read the `project` and `workflow` blocks before taking any workflow action.
2. Treat colloquial phrases as commands when they clearly imply a workflow transition.
3. If the user provides an issue key such as `ABC-123`, use it directly. Otherwise search Linear within `project.team` using the feature or bug phrase.
4. Never invent issue keys, team workflow states, PR links, or repository details. If a match is ambiguous, show up to 3 candidates and ask the user to choose.
5. Resolve Linear access in this order whenever a remote workflow action is needed: first check workspace `.vscode/mcp.json`, then user-profile `mcp.json`, then use any available Linear API / MCP / skill path backed by that configuration.
6. Only fall back to browser-based Linear login when the API / MCP / skill path cannot authenticate or cannot perform the required action.
7. If API, skill, and browser paths are all unavailable, switch to dry-run mode: explain what would be updated and still provide a branch recommendation.
8. Do not silently change remote state. Always tell the user which issue was matched, which status was used, and what the next recommended step is.
9. If `project.team` looks like a token, for example it starts with `lin_api_`, stop and ask for a real Linear team key before mutating anything.
10. If the user provides a Markdown plan or plan file, treat it as workflow input and offer to sync it into Linear todo items.
11. For state transitions, try `workflow.stateAliases` in order and use the first matching Linear state.
12. For plan imports, prefer deterministic matching over aggressive creation: reuse existing issues when the source, section, and title clearly line up.
13. For plan imports, the default unit is the task inside a session or phase. Do not stop at creating only the session or phase container unless the user explicitly asks for session-only summary issues.
14. During phase execution, update Linear at the step level as work progresses. Move the specific task issue to active when that step starts, and move that same issue to done as soon as the scoped validation for that step succeeds.
15. Do not batch multiple step or task status changes into one final sweep at the end of a phase. Report each transition when it happens.
16. When the repository is a git repository with a configured remote, create a commit and push to GitHub immediately after each phase passes its scoped validation. Do not defer phase pushes to the end of the day.
17. Before starting a debug session on a task or phase, create or link a dedicated Linear debug task first. If no matching task exists yet, create one before code changes begin.
18. Before starting a debug session on a task or phase, create and push a checkpoint commit first. After the debug work is validated, create and push a second commit for the fix.
19. When documenting commands, defaults, or behavior changes, update the repository README in Chinese if that file is meant to guide day-to-day development.

# Resolution Order

Use this order to reduce ambiguity.

For work-item workflow requests:

1. Explicit Linear issue key in the user message.
2. Explicit issue title or quoted task name.
3. Best match search within `project.team`.

For Markdown plan sync requests:

1. Explicit Markdown file path from the user.
2. The active editor file if it is a Markdown plan and the user says `这个计划`, `当前文件`, or `同步当前打开的计划`.
3. Inline Markdown pasted by the user.
4. Ask the user which source to sync.

# Intent Mapping

## 1. Start or Resume Work

Trigger examples:

- `开始做登录系统功能`
- `我来做支付重试`
- `继续做报表导出`
- `pick up the auth task`

Actions:

1. Extract the work topic or issue key.
2. Search the configured Linear team if no issue key is provided.
3. If one issue is a clear match, update it to the team's active state such as `In Progress`, `Started`, or the closest equivalent.
  Prefer the first available state from `workflow.stateAliases.active`.
4. Recommend a branch name.
5. If the user explicitly asks to create or switch branches and a git repository is available, create the branch after confirming the target branch name.

When the user starts an entire phase, resolve the child task that is actually being worked on right now and move that child task to the active state immediately instead of only updating the phase container.

Branch naming:

- Feature work: `feature/<ISSUE-KEY>-<slug>`
- Bug fix: `fix/<ISSUE-KEY>-<slug>`
- Chore, refactor, docs, or test work: `chore/<ISSUE-KEY>-<slug>`
- Hotfix: `hotfix/<ISSUE-KEY>-<slug>`

If no issue key can be resolved yet, use a temporary draft branch such as `feature/draft-<slug>` and tell the user it should be rebound to a real issue later.

## 2. Pause or Mark Blocked

Trigger examples:

- `先暂停登录系统`
- `这个任务卡住了`
- `I am blocked on the dashboard export issue`

Actions:

1. Resolve the matching issue.
2. Move it to the team's blocked state if one exists, otherwise use the closest non-active state and explain the fallback.
  Prefer the first available state from `workflow.stateAliases.blocked`.
3. Ask for the blocker reason if the user did not provide one.
4. Summarize what is blocked and what follow-up is needed.

## 3. Finish Coding or Prepare Review

Trigger examples:

- `登录系统做完了`
- `可以提测了`
- `帮我准备发 PR`
- `ready for review`

Actions:

1. Resolve the matching issue.
2. If the user signals code complete but not merged, move the issue to the team's review state such as `In Review`, `Review`, or the closest equivalent.
  Prefer the first available state from `workflow.stateAliases.review`.
3. Recommend a PR title and branch if helpful.
4. If `project.repo` is configured and GitHub tools are available, use that repository when checking PR context.

If the completed work is one task inside a larger phase, update that task immediately after its focused validation succeeds, even when other tasks in the same phase are still in progress.

If the completed work closes an entire phase and the repository has a GitHub remote configured, create a phase completion commit and push it immediately after validation.

## 4. Mark Done or Merged

Trigger examples:

- `这个功能已经合并了`
- `登录系统上线了`
- `this issue is done`

Actions:

1. Resolve the matching issue.
2. Move it to the team's done state.
  Prefer the first available state from `workflow.stateAliases.done`.
3. Report completion clearly and mention any sensible cleanup step, such as deleting the branch only if the user asks.

If the user asks to debug before the work is fully done, create and push a checkpoint commit first, then resume the debug loop.

## 6. Debug or Investigate

Trigger examples:

- `开始 debug 这个接口`
- `先调试一下 TEST-123`
- `这个问题复现了，继续排查`
- `debug this slice`

Actions:

1. Resolve the matching issue or task.
2. If there is no dedicated Linear task for this debug slice yet, create one before changing code.
  Prefer a child task or subtask under the closest matched parent issue when the Linear workspace supports hierarchy.
  If hierarchy is unavailable, create a standalone debug task and link the parent issue in the description.
  Use a concise title such as `调试：<slice>` or `Debug: <slice>`.
3. If the repository is a git repository and a remote is configured, create a checkpoint commit and push it before making debug-only changes.
4. Move the debug task to the active state if it is not already active.
5. After the debug change passes focused validation, create and push a second commit for the fix.
6. Report the created or reused debug task, both commits, and the resulting Linear status update explicitly.

## 5. Sync Markdown Plans to Linear Todo

Trigger examples:

- `把这个 Markdown 计划同步到 Linear`
- `按 session 帮我创建 Linear todo`
- `把 docs/superpowers/plans/2026-05-21-phase-1-foundation.md 同步成 todo`
- `只同步 session1 和 session2`
- `把这份计划拆成多个 todo`

Actions:

1. Read the pasted Markdown or the referenced Markdown file.
  If the user refers to `这个计划` or `当前文件`, use the active Markdown file first.
2. Detect session-like container headings first, then phase headings, then fall back to top-level sections.
  Match case-insensitively, including `session1`, `session 1`, `Session 1`, `phase1`, `Phase 1`, and `阶段1`.
  Prefer headings whose prefix matches `workflow.planSync.containerAliases`.
3. If the user limits the sync scope, only process the requested sessions or phases.
4. By default, create one Linear todo issue per task section inside each session or phase.
  Respect `workflow.planSync.defaultMode` when it is changed from `tasks-within-sessions` to another mode.
  If a session or phase has no task sections, create one issue per unchecked checklist item inside that container.
5. Use `workflow.planSync.titleFormat` to build issue titles, for example `[Plan Title] Session 1 - Foundation / Backend Health Slice`.
6. Put the container summary, task summary, and unchecked task-local checklist items into the issue description as Markdown.
7. Add stable source metadata at the bottom of each issue description when possible:
  - `Source Plan: <file path or inline>`
  - `Source Container: <session or phase heading>`
  - `Source Task: <task heading or checklist item>`
  - `Sync Key: <normalized plan>::<normalized container>::<normalized task>`
8. Ignore completed checklist items such as `- [x]` unless `workflow.planSync.includeCompleted` is true or the user explicitly asks to sync completed work too.
9. If the user explicitly asks for session-only summary issues, create one Linear todo issue per session or phase instead of per task.
10. If the user explicitly asks to split the plan more finely, create one Linear todo issue per unchecked leaf checklist item instead of per task section.
11. Before creating more than `workflow.planSync.splitThreshold` issues, summarize the import plan and ask for confirmation.
12. If matching Linear issues already exist, prefer updating or reusing them instead of creating duplicates when the intent is clearly a re-sync.
   When `workflow.planSync.reuseExisting` is true, search by `Sync Key`, exact title, and source file before creating a new issue.

Default mapping:

- Session or phase heading -> container context, not an issue by default
- `### Task` inside a session or phase -> one Linear todo issue by default
- If no task heading exists inside a session or phase -> one Linear issue per unchecked checklist item in that container
- Explicit request to split more finely -> one Linear issue per unchecked checklist item
- Explicit request for summary import -> one Linear issue per session or phase
- If no session or phase heading exists -> fall back to `workflow.planSync.fallbackMode`, usually task-level import

# Branch Type Heuristics

Infer the branch type from the user's phrasing when no issue type is explicit.

- Contains `bug`, `修`, `修复`, `报错`, `异常` -> `fix`
- Contains `重构`, `refactor`, `清理`, `文档`, `测试`, `脚手架`, `配置` -> `chore`
- Contains `hotfix`, `紧急`, `线上修复` -> `hotfix`
- Otherwise default to `feature`

Use a concise English kebab-case slug when possible. Prefer the actual issue title over the raw user phrase when both are available.

# Response Format

When this rule is active, prefer a short structured response with these labels:

- `意图:` the workflow intent you recognized
- `任务:` the matched issue or the ambiguity warning
- `Linear:` the status change you made or would make
- `分支:` the recommended branch name
- `下一步:` the next command or decision needed

If the rule had to fall back from the default import mode, say so explicitly.

For Markdown plan sync requests, also include these labels when useful:

- `来源:` the Markdown file or inline plan you used
- `范围:` the sessions, phases, or tasks included in this sync
- `同步:` how many Linear todo items were created or would be created

# Safety and Fallbacks

- If `project.team` is still a placeholder, ask the user to fill it in before attempting Linear updates.
- If `project.team` looks like an API token instead of a team key, tell the user to move that secret back into `.vscode/mcp.json` and replace `project.team` with a real team key such as `TEST` or `LHX`.
- If `.vscode/mcp.json` exists, prefer reading the Linear auth data from it before asking the user to log in through the browser.
- If both workspace and user-level `mcp.json` exist, prefer the workspace file first and use the user-level file only as a fallback.
- If `mcp.json` uses input variables such as `${input:linear-api-key}`, prefer the corresponding API or MCP path first; only ask for browser login when those paths cannot be used.
- If `project.team` looks like a human-readable team name instead of a key, resolve it to the real key or ask the user to correct it before continuing.
- If `project.repo` is still a placeholder, do not fabricate PR URLs or repository actions.
- If the repository has no configured Git remote, say explicitly that the phase commit or debug checkpoint would be created locally but cannot be pushed yet.
- If multiple issues match, stop before mutating anything and ask the user to pick one.
- If no issue matches during normal work, suggest creating or linking a Linear issue before advancing the workflow.
- If the user explicitly enters a debug workflow and no matching issue exists, create or propose a dedicated Linear debug task before any code changes. Only fall back to dry-run when remote Linear actions are unavailable.
- If the Markdown plan has no session or phase structure, fall back to the top-level sections or ask the user whether to sync by section or by checkbox task.
- If the Markdown plan has session headings and task headings, do not collapse them into one session issue unless the user explicitly asks for a summary import.
- If the active file is not Markdown and the user says `同步当前文件`, ask for the Markdown source instead of guessing.
- If a re-sync would create duplicates because the title format changed, explain that risk and ask whether to reuse by title or create fresh issues.
- If browser login is used as a fallback, say explicitly that API and skill-based paths were attempted first and why they were not used.

# Example

User: `开始做登录系统功能`

Preferred behavior:

1. Search the configured Linear team for the best login-system match.
2. If exactly one issue matches, move it to the team's active state.
3. Recommend a branch such as `feature/ABC-123-login-system`.
4. Reply using the response format above.

User: `把 docs/superpowers/plans/2026-05-21-phase-1-foundation.md 同步到 Linear，把每个 session 里的任务都创建出来`

Preferred behavior:

1. Read the Markdown plan.
2. Detect the sessions or phases, then detect the task sections inside them.
3. Summarize how many task-level Linear todo issues will be created.
4. Create or propose one Linear todo issue per task using the default mapping above.
5. Reply using the response format above, adding `来源:`, `范围:`, and `同步:`.

User: `把当前打开的 Markdown 计划同步到 Linear，尽量复用已有 todo`

Preferred behavior:

1. Use the active Markdown file as the source.
2. Parse sessions first, then task sections, and fall back only if no session or phase structure exists.
3. Search for existing issues by `Sync Key`, exact title, and source metadata.
4. Reuse matching issues when safe, and only create new ones for unmatched tasks.
5. Tell the user whether the sync was a create, update, or mixed run.