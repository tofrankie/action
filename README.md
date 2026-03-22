# @tofrankie/action

> [!WARNING]
> 当前版本仍在快速迭代，暂未稳定，可能出现 Breaking Changes。

根据 `tag` 自动创建或更新 GitHub Release，并可按需发布 npm。同时提供交互式 CLI，用于在本地手动创建/更新 GitHub Release 与重放发布流程。

## 提供了什么

- 同时支持单包、多包仓库
- 从 `CHANGELOG.md` 自动提取本次 GitHub Release 的标题与正文
- GitHub Release 幂等：同一 `tag` 重复执行时更新而不是重复创建
- npm 发布可选：版本已存在时自动跳过并返回状态
- 支持 `push tags` 与 `workflow_dispatch` 两种触发方式

## GitHub Action 使用

### 最简用法

监听 tag 推送，自动创建 GitHub Release，不发布到 npm 平台。

> 若该 `tag` 已存在对应的 GitHub Release，则会更新该 GitHub Release（幂等行为）。

```yaml
name: Create GitHub Release

on:
  push:
    tags:
      - '**'

permissions:
  # 必需：创建/更新 GitHub Release 需要仓库 contents 写权限
  contents: write

jobs:
  github-release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: tofrankie/action@v1
```

### 进阶用法

如果你是第一次配置 GitHub Action，可以按下面顺序使用：

- 先按最简示例配置（不额外传参），跑通「自动创建/更新 GitHub Release」
- 需要手动重跑某个版本时，再使用 `workflow_dispatch` 传 `tag`
- 需要同时发 npm 时，再开启 `publish-npm` 并确保环境已配置好 npm 鉴权（如通过 `actions/setup-node`）

常见场景推荐配置：

- 仅发布 GitHub Release：无需额外参数，参考最简示例
- 手动重跑指定版本：`tag`
- 发布 GitHub Release + 发布 npm 包：`publish-npm: true`

### 为什么建议同时开启 `workflow_dispatch`

发布流程常见失败并不一定来自代码本身，例如网络抖动、权限不足、token 失效、changelog 条目不匹配。  
这些问题修复后，通常需要手动再执行一次同一版本的 GitHub Release 发布流程，因此建议在 `push tags` 之外开启 `workflow_dispatch`。

### 进阶工作流示例（支持重放）

> 重放：不重新创建 tag，而是对同一 `tag` 的 GitHub Release 发布流程手动再执行一次（常用于首次失败后的补跑）。

```yaml
name: Create GitHub Release

on:
  push:
    tags:
      - '**'
  workflow_dispatch:
    inputs:
      tag:
        description: 'Tag to replay'
        required: true

permissions:
  contents: write

jobs:
  github-release:
    runs-on: ubuntu-latest
    concurrency:
      group: github-release-${{ github.event.inputs.tag || github.ref_name }}
      cancel-in-progress: false
    steps:
      - uses: actions/checkout@v6

      # 如果需要发布到 npm，通常需要配置 node 并设置 registry/token
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          registry-url: 'https://registry.npmjs.org'

      - uses: tofrankie/action@v1
        with:
          github-token: ${{ github.token }}
          tag: ${{ github.event.inputs.tag }}

          # 默认仅发布 GitHub Release，不发布 npm 包，若需要可开启 `publish-npm`
          # publish-npm: true
        env:
          # actions/setup-node 会自动识别该变量用于 npm publish 鉴权
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

更多参数说明：

- `tag`：可选；`workflow_dispatch` 场景建议显式传入
- `publish-npm`：默认 `false`
- `changelog-path`：可选；默认自动解析 `CHANGELOG.md`

### Run workflow 参数填写说明

在 GitHub Actions 页面点击 **Run workflow** 后，可填写：

- `tag`（建议必填）：要创建/更新 GitHub Release 的版本 tag，例如 `v1.2.3`、`pkg-a@1.2.3`

填写建议：

- 补跑同一版本的 GitHub Release：填写 `tag` 即可
- monorepo：`tag` 需带包名（`name@version` 或 `@scope/name@version`）

如果你习惯命令行，也可以用 [GitHub CLI](https://cli.github.com/) 手动触发：

```bash
# 仅指定 tag（常见补跑场景）
gh workflow run release.yml -f tag=v1.2.3

# monorepo 示例（注意 tag 需带包名）
gh workflow run release.yml -f tag='@scope/pkg-a@1.2.3'
```

### 输出参数

- `github-release-url`：GitHub Release 页面 URL
- `npm-status`（`skipped` / `published` / `already-exists`）
- `resolved-package-name`
- `resolved-version`

## 必要约束

### Tag 格式

单包仓库支持：

- `@scope/name@<version>`
- `name@<version>`
- `v<version>`
- `<version>`

monorepo 仅支持以下格式：

- `@scope/name@<version>`
- `name@<version>`

### Changelog 规则

必须存在 `CHANGELOG.md`（或显式指定 `changelog-path`），并包含对应版本条目。  
对于 monorepo，会先根据 workspace 与 tag 解析目标包，再匹配该包对应的 `CHANGELOG.md` 条目；这也是多包仓库必须使用带包名 tag（如 `name@version`）的原因。

标题匹配规则：

- 只要标题包含以下任一标识，即可匹配到对应版本：
  1. `<packageName>@<version>`（如 `@scope/pkg-a@1.2.3`）
  2. `<unscopedName>@<version>`（如 `pkg-a@1.2.3`）
  3. `v<version>`（如 `v1.2.3`）
  4. `<version>`（如 `1.2.3`）
- 命中后会将该行标题（`##` 后的完整原文）直接作为 GitHub Release 标题

示例（`CHANGELOG.md`）：

```md
# Changelog

## @scope/pkg-a@0.0.4 - 2026-03-21

### Features

- add xxx

## @scope/pkg-a@0.0.3 - 2026-03-18

### Fixes

- fix yyy

## pkg-a@0.0.2 (2026-03-17)

- non-functional changes

## Release for pkg-a@0.0.1 🚀

- custom heading style
```

## Action 背后做了什么

每次执行时，Action 会按顺序完成：

1. 解析 `tag`，识别包名与版本（兼容单包/monorepo）
2. 定位并读取对应 `CHANGELOG.md` 条目，生成 GitHub Release 的标题与正文
3. 创建或更新同名 GitHub Release（幂等）
4. 若开启 `publish-npm`，先检查版本是否存在，再决定发布或跳过
5. 输出 `github-release-url`（GitHub Release URL）、`npm-status`、`resolved-package-name`、`resolved-version`

## 常见失败原因

- 推送 tag 后没有任何 workflow run：确认 **默认分支** 上已存在对应 workflow 文件，且仓库 **Actions** 已开启（Fork 需单独启用）
- `permissions.contents` 不是 `write`，导致无法创建或更新 GitHub Release
- `tag` 格式不符合规则（尤其是 monorepo 使用了 `v1.2.3` 这类不带包名格式）
- `CHANGELOG.md` 缺少对应版本条目，或标题与当前 `tag`/版本无法匹配
- 开启了 `publish-npm` 但环境未配置好 npm 鉴权（如缺少 `.npmrc` 或鉴权 Token 环境变量）

## FAQ

1. **同一 tag 重复执行会怎样？**
   - 若与当前 tag 对应的 GitHub Release 不存在，则会创建；
   - 若与当前 tag 对应的 GitHub Release 已存在，则会更新；
   - 若与当前 tag 对应版本的 npm 包已存在，则会跳过；

## CLI 用法

[![npm version](https://img.shields.io/npm/v/@tofrankie/action)](https://www.npmjs.com/package/@tofrankie/action) [![node version](https://img.shields.io/node/v/@tofrankie/action)](https://nodejs.org) [![npm package license](https://img.shields.io/npm/l/@tofrankie/action)](https://github.com/tofrankie/action/blob/main/LICENSE) [![npm last update](https://img.shields.io/npm/last-update/@tofrankie/action)](https://www.npmjs.com/package/@tofrankie/action)

本仓库内直接运行：

```bash
$ pnpm add -D @tofrankie/action
```

支持 `tofrankie-release` 或 `tfr`（简写）两个命令。

### 常用参数

- `--token <token>`：GitHub Token（优先级高于环境变量）
- `--tag <tag>`：指定 tag，跳过 tag 选择
- `--publish-npm`：开启 npm 发布。需确保环境已具备发布权限，建议在项目根目录配置 `.npmrc`：
- `--yes`：跳过确认

> GitHub Token 读取优先级：`--token` → 环境变量 `GITHUB_RELEASE_TOKEN` → 环境变量 `GITHUB_TOKEN`

```ini
# .npmrc 示例
//registry.npmjs.org/:_authToken=${NPM_TOKEN}
```

参数示例：

```bash
# 指定 tag（仍会进入确认；传 --yes 可跳过）
$ npx @tofrankie/action tfr --tag v1.2.3

# 同时发布 npm（需本地环境已具备发布权限）
$ npx @tofrankie/action tfr --tag v1.2.3 --publish-npm

# 显式指定 GitHub token
$ npx @tofrankie/action tfr --tag v1.2.3 --token <github_token>
```

### 如何创建 GitHub Token（最小权限）

本工具会读取 tags、读取/创建/更新 GitHub Release，因此需要对目标仓库具备 `contents` 写权限。

- **Fine-grained PAT（推荐）**
  1. GitHub 头像 → `Settings` → `Developer settings` → `Personal access tokens` → `Fine-grained tokens`
  2. `Generate new token`
  3. `Resource owner` 选择所有者，选择当前用户或所属组织
  4. `Repository access` 选择目标仓库（建议只选需要发布的仓库）
  5. `Repository permissions` 至少授予：`Contents: Read and write`
  6. 创建后复制 token，作为 `--token` 或环境变量 `GITHUB_RELEASE_TOKEN`

- **Classic PAT**
  - 公开仓库：最少可用 `public_repo`
  - 私有仓库：需要 `repo`

建议优先使用 Fine-grained PAT，并仅授权最小仓库范围。

### CLI 做了什么

CLI 与 Action 共用同一套核心逻辑（`publishRelease`），大致步骤如下：

1. 解析命令行参数，并解析 GitHub Token（`--token` 或环境变量）
2. 从本地 `git remote` 推断 GitHub 仓库 `owner/repo`
3. 扫描当前目录下的可发布包（单包或多包 workspace）；多包时需交互选择包
4. 通过 GitHub API 拉取远程 tags，并按包名过滤出可选 tag
5. 选择要关联本次 GitHub Release 的 tag（可用 `--tag` 跳过选择）
6. 解析 tag、定位包目录、解析 `CHANGELOG.md` 路径并读取对应版本条目
7. 在终端打印本次 GitHub Release 的预览（包名、tag、版本、changelog 标题与正文）
8. 确认是否创建/更新 GitHub Release（传 `--yes` 则跳过该确认）
9. 若传了 `--publish-npm` 且未传 `--yes`，会再确认是否发布 npm；选否则只发 GitHub Release
10. 调用核心流程：创建或更新 GitHub Release，并在确保本地鉴权有效的情况下执行 npm 发布
