# @tofrankie 发版清单

面向 `@tofrankie` scope 包的发版流程；将下文 `@tofrankie/example`、`<version>` 换为实际包名与版本号。

## 发版之前检查清单

以下任一步失败或未通过时，应先修复再往后进行。

1. 若存在 `lint` 脚本：执行 `pnpm lint`；若无则可跳过或先补全脚本。
2. 若存在 `publint` 脚本：执行 `pnpm publint`，检查包规范与多环境兼容性。
3. 若存在 `test` 脚本：执行 `pnpm test`。
4. 执行 `pnpm build`，确认构建成功。
5. **版本号**：将 `package.json` 中的 `version` 与 registry 对比，例如：
   - `npm view @tofrankie/example version`（无发布记录则可能报错，表示首版）。
   - 再次发布时，本地 `version` 须**高于** registry 上最新版本，且与本次意图一致（避免重复发同一版本号）。
6. 已 bump 版本后，检查 `CHANGELOG.md` 是否包含**本次**要发布的版本说明。

## 打 tag 与 GitHub Release

打 tag 前通常已将代码推到远程；若本地仍有未提交改动，按下列方式处理。

1. **[务必]** 执行 `git status`。若工作区有改动且不希望打进本次发布认知中的「已发布代码」，可先 `git stash push -m "release: wip"`，避免与已提交发布内容混淆（tag 始终指向**当前提交**，stash 不改变已提交历史）。
2. 创建 tag（tag 名含 `@`，在 zsh/bash 中建议加引号）：
   - `git tag '@tofrankie/example@<version>'`
   - 例：`git tag '@tofrankie/example@0.0.1'`
3. 推送 tag：
   - `git push origin 'refs/tags/@tofrankie/example@<version>'`
   - 或：`git push origin '@tofrankie/example@<version>'`（部分环境需引号，避免 `@` 被解析。）
4. 从 `CHANGELOG.md` 复制**本版本**条目全文，写入（或覆盖）`CHANGELOG.local.md`，供 release 说明使用。
5. 创建 GitHub Release：
   - `gh release create '@tofrankie/example@<version>' --title '@tofrankie/example@<version>' --notes-file ./CHANGELOG.local.md`
6. 若第 1 步曾 stash：执行 `git stash pop` 恢复本地改动。

## 发版之后（可选）

- 执行 `pnpm publish`（或 CI 自动发布）将包推到 npm。
- 确认 npm 页与 GitHub Release 中版本号、说明一致。
