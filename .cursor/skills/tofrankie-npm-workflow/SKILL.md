---
name: tofrankie-npm-workflow
description: Audits @tofrankie scoped npm packages for publish readiness and guides release (lint, publint, version bump, git tag, gh release, npm publish). Use for @tofrankie packages, npm 包完整度, 发版, release checklist, or tofrankie publish workflow.
---

# @tofrankie npm 工作流

## 何时读哪份材料

| 场景                                     | 先读                                         |
| ---------------------------------------- | -------------------------------------------- |
| 新建/整理包、发 npm 前自检               | [package-checklist.md](package-checklist.md) |
| 版本已备好、要打 tag / Release / publish | [release-checklist.md](release-checklist.md) |

将文档中的 `@tofrankie/example`、`example`、仓库 URL 一律替换为当前项目的 `package.json` 的 `name` 与真实 GitHub 仓库名。

## Agent 执行要点

**包完整度（package-checklist）**

1. 按 [package-checklist.md](package-checklist.md) 逐项对照 `package.json`、`.npmrc`、`.gitignore`、`README.md`、`CHANGELOG.md`。
2. 缺项则补全或提醒用户补全；不要覆盖用户已有 `.npmrc` 中的敏感配置，只追加 scope/registry/token 变量行。
3. 收尾跑 `pnpm publint`、`pnpm publish --dry-run`（若项目使用 pnpm）。

**发版（release-checklist）**

1. 按 [release-checklist.md](release-checklist.md) 顺序执行；任一步失败则停止并说明原因。
2. 含 `@` 的 git tag / `gh release` 在 shell 中需引号。
3. `lint` / `publint` / `test` 仅在对应脚本存在时执行。

## 与 wip 文档的关系

仓库内 `wip/tofrankie-npm-package-checklist.md` 与 `wip/tofrankie-release-checklist.md` 可与本 skill 的 `package-checklist.md` / `release-checklist.md` **同步维护**；以本目录下文件为 Agent 实际读取来源。
