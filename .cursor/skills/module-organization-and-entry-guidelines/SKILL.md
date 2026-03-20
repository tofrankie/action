---
name: module-organization-and-entry-guidelines
description: Enforces JavaScript/TypeScript module organization and entry-function structure. Use when refactoring module layout, improving top-down readability, introducing CLI/script entrypoints, or when the user mentions main 函数、函数声明提升、模块组织规范.
---

# 模块组织与入口规范

将模块改造成“从上往下可读”的结构，核心是：顶层优先函数声明、入口函数前置、CLI/脚本统一 `main()` 入口。

## 适用场景

- 用户要求“整理模块结构”“按函数提升重排代码”“统一入口函数”
- 在 JS/TS 文件中存在大段顶层执行语句，需要收敛到 `main()`
- CLI 入口文件或一次性脚本需要更清晰的执行流程

## 执行步骤

1. 识别文件角色：
   - **模块文件**：主要对外导出能力。
   - **CLI/脚本入口文件**：会直接执行。
2. 统一顶层函数形态：优先使用函数声明（`function foo() {}`），避免把核心流程写成函数表达式后再在顶层拼接执行。
3. 按“自顶向下阅读”重排：
   - 需要导出的函数（或变量）放前面
   - 内部辅助函数应按入口主流程的调用顺序自上而下排列，保证读者可沿文件从上到下追踪执行路径。
   - 充分利用函数声明提升特性：可先组织主流程调用，再在后文给出函数实现，不要求“先定义后调用”。
   - 当存在并列或交叉调用时，按“主线优先、分支随后；高频优先、低频随后”组织。
4. 对 CLI/脚本入口文件：
   - 增加 `main` 函数承载主流程
   - 将 `main()` 调用放在 `main` 函数声明之前
   - 避免在模块顶层直接堆叠业务步骤
5. 变更后快速自检：
   - 入口路径不变（导出名、执行结果、参数语义不变）
   - 无新增副作用顺序问题
   - 原有命令能正常执行（如 `node xxx.js` 或对应 npm script）

## 最小示例

```js
import someModule from './someModule.js'

main()

function main() {
  foo()
  bar()
  someModule()
}

function foo() {}
function bar() {}
```
