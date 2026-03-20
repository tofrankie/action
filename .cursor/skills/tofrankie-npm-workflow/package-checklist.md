# @tofrankie/example 包完整度检查清单

面向 `@tofrankie` scope 的 npm 包完整度检查清单（将 `example` 换为实际仓库名即可）。

## 检查清单

1. 包名以 `@tofrankie/` scope 开头（示例：`@tofrankie/example`）。
2. 使用 pnpm 管理依赖，并在 `packageManager` 中锁定版本（若尚未填写，可用 `npm view pnpm version` 取当前最新 pnpm 主版本写入）。
3. 添加 `author` 字段，例如：`Frankie <1426203851@qq.com> (https://github.com/tofrankie)`。
4. 添加 `repository` 字段，例如：`{ "type": "git", "url": "git+https://github.com/tofrankie/example.git" }`；可用 `npm pkg fix` 修正格式。
5. 添加 `homepage`、`bugs`，指向对应 GitHub 仓库。
6. 检查 `type` 字段：若以 **ESM** 对外发布，宜为 `"module"`；若以 **CJS** 为主或构建产物已区分格式，则按实际约定，不必强行设为 `module`。
7. 检查 `license` 字段（缺失时提醒补充）。
8. 检查 `keywords`（为空时提醒补充）。
9. 检查 `description`（为空时提醒补充）。
10. 检查 `files` 字段：
    - npm 会始终打包：`package.json`、`README*`、`LICENSE`/`LICENCE`；会跟随 `main` **入口文件**（通常仅为该文件，而非整个目录）。
    - 若构建产物在目录（如 `dist/`）中，须在 `files` 中显式包含该目录，否则可能只打进单文件、漏掉同目录其它文件。
    - `bin` 指向的可执行文件须在发布包内存在；若不在上述自动范围内，也应在 `files` 中写明。
    - 常见补充：`CHANGELOG.md`、`dist`（或实际产物目录）。
    - 若无 `CHANGELOG.md`，则创建；二级标题可不写 `@tofrankie` 前缀。
11. 检查 `scripts`：
    - 建议包含 `build`、`dev`（若无可先占位，具体命令按项目补全）。
    - 建议包含 `"prepublishOnly": "pnpm build"`。
    - 建议包含 `"publint": "publint"`；未安装时执行 `pnpm add -D publint`。
    - 若依赖 **husky**：建议 `"prepare": "husky"`，并存在 `.husky` 目录；若无可 `npx husky init`。若项目有 `lint` 脚本，`.husky/pre-commit` 宜调用 `pnpm lint`（不一致则提醒）。
12. scoped 包须具备发布权限，并设置 `"publishConfig": { "access": "public" }`。
    - 检查项目或用户级 `.npmrc` 是否包含下文示例（尤其是 scope registry 与 token 变量名）。
13. 检查 `README.md`；若有中文说明，可另备 `README.zh-CN.md`。
14. 检查 `.gitignore` 是否包含以下示例内容，补充缺少的内容，并适当分类。
15. 上述项通过后：
    1. 通读 `package.json`、`CHANGELOG.md`、`README.md`：表述准确、简洁、一致，用法无歧义。
    2. 执行 `pnpm publint`。若执行结果有建议，则按建议修改。
    3. 执行 `pnpm publish --dry-run`，对照 `files` 与打包结果，避免漏打或多打。

## 示例文件

### .npmrc 示例

至少包含下列内容；若已有 `.npmrc`，在末尾**追加**缺失项（勿覆盖已有私有配置）。示例的注释部分也要加上。

```
@tofrankie:registry=https://registry.npmjs.org/
//registry.npmjs.org/:_authToken=${TOFRANKIE_SCOPE_NPM_TOKEN}

# For local Verdaccio debugging, use instead:
# @tofrankie:registry=http://localhost:4873/
```

### CHANGELOG.md 示例

版本从新到旧。二级标题可不写 `@tofrankie` 前缀。书写可参考 [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)；条目很多时可再分子章节或链到详细文档。

```
# Changelog

## example@0.0.1 (2026-03-19)

- some changes
- some other changes
- ...
```

### README.md 示例

一级标题与 badge 中的包名须与 `package.json` 的 `name` 一致。

```
# @tofrankie/example

[![npm version](https://img.shields.io/npm/v/@tofrankie/example)](https://www.npmjs.com/package/@tofrankie/example) [![node version](https://img.shields.io/node/v/@tofrankie/example)](https://nodejs.org) [![npm package license](https://img.shields.io/npm/l/@tofrankie/example)](https://github.com/tofrankie/example/blob/main/LICENSE) [![npm last update](https://img.shields.io/npm/last-update/@tofrankie/example)](https://www.npmjs.com/package/@tofrankie/example)
```

### .gitignore 示例

> [gitignore 说明](https://git-scm.com/docs/gitignore)

```
# Dependency
node_modules/
dist/
.husky/_/
.pnpm-store

# Logs
logs
*.log

# OS
.DS_Store
desktop.ini

# Cache
*.tsbuildinfo
.eslintcache
.stylelintcache

# Test
coverage/

# Local
.env
.env.*
!.env.example
CHANGELOG.local.md
*.tgz
```

（按需增加编辑器、IDE 或本机配置文件忽略规则；避免使用过宽通配以免误伤合法源码。）
