# LC-Coder 工作计划

> 小模型流水线编码工具 — 让 4B 参数的 AI 也能高质量编码

## 项目概述

通过「流水线编排 + 文档交接 + 会话隔离」架构，用代码强约束替代提示词引导，让小型 AI 模型完成复杂编码任务。

- **仓库**: `/Users/yinjames/projects/lc-coder`
- **技术栈**: Bun + TypeScript + Ollama + Zod + @clack/prompts
- **目标模型**: Gemma 4 E4B (gemma4:latest) via Ollama
- **Ollama 地址**: `http://192.168.68.210:11434`（4070 8GB 显卡机器）
- **协议**: MIT 开源

---

## 已完成

### ✅ Phase 0: 项目骨架 + LLM 通信
- [x] Bun + TypeScript 项目初始化
- [x] 依赖安装 (ollama, @clack/prompts, zod, chalk, ora)
- [x] LLM Provider 抽象接口 + Ollama 实现
- [x] 独立会话管理器（多轮 tool call 支持）
- [x] Tool call 回退文本解析器
- [x] 工具注册中心 + 6 个工具 (file_read/write/patch, dir_list, grep_search, shell_exec)
- [x] 文档 Schema 定义 (Zod): requirement, plan, instruction, result, evaluation, summary
- [x] 配置管理（项目级 .lc-coder/config.json）

### ✅ Phase 1: 流水线 MVP
- [x] 复杂度分类器
- [x] 5 个角色实现 (产品经理, 项目经理, 办事员, 评估器, 分类器)
- [x] 5 个独立 Prompt 文件 (prompts/*.md)
- [x] BaseRole 基类（Prompt 加载、会话创建、JSON 提取）
- [x] 流水线编排器（硬编码 5 步流程）
- [x] 任务分发器
- [x] 文档存储管理
- [x] CLI 入口 + 交互界面
- [x] E2E 测试（已验证: 分类器✓ 项目经理✓ 办事员✓ 评估器✓）
- [x] Bug 修复：Session 多轮 tool call + Schema null 兼容

**首次提交**: `f4016e9` — 43 files, 3474 lines

---

## 待完成

### 🔲 Phase 2: 健壮性增强

核心目标：让流水线在真实项目中稳定运行，处理各种边界情况。

- [ ] **产品经理 Prompt 调优**
  - E2E 测试中产品经理虽然能调用工具，但最终生成的需求文档需要更多验证
  - 用多个真实需求测试，收集失败案例，迭代优化 Prompt
  - 考虑给产品经理加一个"总结提示"，在最后一轮工具调用后明确要求输出 JSON

- [ ] **失败重试机制**
  - 当角色输出 JSON 解析失败时，自动重试（最多 N 次）
  - 重试时在消息中指出上次的格式问题，帮助模型修正
  - 配置项 `execution.maxRetries`

- [ ] **断点续传**
  - 保存流水线执行状态到 `.lc-coder/current/pipeline-state.json`
  - 支持 `lc-coder resume` 命令，从中断处继续
  - 适用于：网络中断、Ollama 崩溃、用户主动中断

- [ ] **自动验证层**
  - 办事员执行完任务后，自动运行验证：
    - TypeScript 类型检查 (`tsc --noEmit`)
    - Lint 检查
    - 测试运行（如果项目有测试）
  - 验证结果写入执行报告

- [ ] **安全确认机制**
  - `shell_exec` 执行前提示用户确认（除非 `safety.allowShellExec = true`）
  - `file_write` 覆盖已有文件前提示确认
  - 危险命令黑名单（rm -rf, sudo 等）

- [ ] **进度展示优化**
  - 用 spinner 显示当前正在等待的阶段
  - 流式输出模型回复（而不是等完整回复）
  - 估算剩余时间

---

### 🔲 Phase 3: 体验增强

核心目标：让工具开箱即用，体验接近商业产品。

- [ ] **每个角色可配不同模型**
  - 分类器/评估器用小模型（快速、便宜）
  - 项目经理/办事员用较大模型（更强能力）
  - 配置示例：`roles.clerk.model = "gemma4:26b"`

- [ ] **并行任务执行**
  - 分析任务依赖图，无依赖的任务并行分发
  - 需要处理文件冲突（两个任务修改同一文件）

- [ ] **项目上下文自动提取**
  - 自动检测语言、框架、构建工具
  - 读取 package.json / pyproject.toml / Cargo.toml 等
  - 生成项目摘要注入到角色 Prompt 中

- [ ] **`lc-coder init` 命令**
  - 在项目中初始化 `.lc-coder/config.json`
  - 交互式配置：选择模型、Ollama 地址等

- [ ] **更多 AI 提供商支持**
  - OpenAI 兼容 API（支持 vLLM、LocalAI 等）
  - 远程 API（GPT-4o-mini、Gemini Flash 等）
  - 提供商选择器

- [ ] **会话历史查看**
  - `lc-coder history` 查看过去的执行记录
  - `lc-coder inspect <session-id>` 查看某个会话的详细记录

---

### 🔲 Phase 4: 高级功能

长期愿景，将流水线从"能用"提升到"强大"。

- [ ] **动态粒度调节**
  - 根据模型能力自动调节任务拆分粒度
  - 小模型→更细粒度，大模型→更粗粒度
  - 通过初始基准测试评估模型能力

- [ ] **Prompt 版本管理**
  - 记录每个 Prompt 版本的测试通过率
  - A/B 测试不同的 Prompt 变体
  - Prompt 性能面板

- [ ] **插件系统**
  - 自定义角色（如 "测试工程师"、"DBA"）
  - 自定义工具（如 Docker 操作、数据库查询）
  - 社区共享 Prompt 和角色

- [ ] **Web 控制面板**
  - 实时显示流水线执行进度
  - 文档预览和编辑
  - 可视化任务依赖图

- [ ] **多项目协同**
  - 一个流水线操作跨多个项目/仓库
  - Monorepo 支持

---

## 已知问题

1. **产品经理输出不稳定** — 多轮 tool call 后可能生成不完整的 JSON，需要 Prompt 调优和重试机制
2. **VS Code lint 误报** — `Cannot find module './tool-parser.js'` 是 Bun 的 .js→.ts 解析机制导致的 IDE 误报，不影响运行
3. **推理速度** — 4070 8GB 上 E4B 每次角色调用约 15-100s，整个流水线约 5 分钟，有优化空间

---

## 测试记录

### 2026-04-05 首次 E2E 测试
- **环境**: gemma4:latest on RTX 4070 8GB (192.168.68.210)
- **测试需求**: "创建 utils.ts 文件并导出 add 函数"
- **结果**: 5/7 完美通过，1 优秀，1 有 bug（已修复）
- **详细报告**: 见对话 `30152a35` 的 `test_evaluation.md`
