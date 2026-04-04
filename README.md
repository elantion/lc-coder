# LC-Coder

> 小模型流水线编码工具 — 让小型 AI 模型也能高质量编码

LC-Coder 通过「流水线编排 + 文档交接 + 会话隔离」架构，让 4B 参数的小模型（如 Gemma 4 E4B）也能完成复杂的编码任务。

## ✨ 核心理念

传统 AI 编码工具把所有工作塞在一个会话里，导致上下文膨胀、模型失控。LC-Coder 采用制造业流水线思想：

1. **角色分离** — 产品经理、项目经理、办事员、评估器各司其职
2. **会话隔离** — 每个步骤都是独立会话，避免上下文污染
3. **文档交接** — 通过结构化 JSON 文档传递信息，可审计可追溯
4. **代码强约束** — 流程由代码硬编码控制，不依赖提示词引导

## 🚀 快速开始

### 前置条件

- [Bun](https://bun.sh) >= 1.0
- [Ollama](https://ollama.com) 已安装并运行
- Gemma 4 E4B 模型已拉取

```bash
# 安装 Ollama 后拉取模型
ollama pull gemma4:e4b
```

### 安装

```bash
git clone https://github.com/your-username/lc-coder.git
cd lc-coder
bun install
```

### 运行

```bash
bun start
```

## 📋 工作流程

```
用户输入 → 分类器判断 → 简单请求：直接回答
                      → 复杂请求：
                          ↓
                    产品经理分析需求
                          ↓
                      用户确认需求
                          ↓
                    项目经理拆分任务
                          ↓
                      用户确认计划
                          ↓
                  办事员逐一执行任务 ←→ 评估器判断结果
                          ↓
                      生成总结报告
```

## 🏗 项目结构

```
lc-coder/
├── src/
│   ├── cli/          # CLI 交互
│   ├── llm/          # LLM 通信层
│   ├── pipeline/     # 流水线编排
│   ├── roles/        # 角色定义
│   ├── schemas/      # 文档 Schema (Zod)
│   ├── tools/        # AI 可调用的工具
│   ├── documents/    # 文档存储
│   └── config/       # 配置管理
├── prompts/           # 角色 Prompt (Markdown)
│   ├── classifier.md
│   ├── product-manager.md
│   ├── project-manager.md
│   ├── clerk.md
│   └── evaluator.md
└── .lc-coder/         # 运行时工作目录 (自动生成)
```

## ⚙️ 配置

在项目目录下创建 `.lc-coder/config.json`：

```json
{
  "model": "gemma4:e4b",
  "ollamaHost": "http://localhost:11434",
  "roles": {
    "clerk": { "model": "gemma4:26b" }
  },
  "execution": {
    "maxRetries": 2
  }
}
```

## 🎯 设计特色

- **Prompt 外置** — 所有角色的 System Prompt 都是独立的 Markdown 文件，可随时查看和优化
- **文档可审计** — 每个步骤的中间文档都保存在 `.lc-coder/documents/` 下
- **容错机制** — Tool call 解析失败时自动回退到文本解析
- **保守策略** — 评估器在不确定时选择暂停，等待人工介入

## 📜 License

MIT
