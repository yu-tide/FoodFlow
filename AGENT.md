# FoodFlow — AI Workflow 驱动的饮食记录与营养分析系统

核心工作流：Input → OCR → Parse → Rule Engine → AI Pipeline → Statistics

## 文档索引

按开发模块选择性读取对应规范：

| 文档 | 适用场景 |
|------|----------|
| [docs/architecture.md](docs/architecture.md) | 了解项目定位、核心原则 |
| [docs/tech-stack.md](docs/tech-stack.md) | 前后端/数据库技术选型 |
| [docs/development-workflow.md](docs/development-workflow.md) | 开发流程与协作规范 |
| [docs/ai-engineering.md](docs/ai-engineering.md) | AI Pipeline / Cache / Logs |
| [docs/git-workflow.md](docs/git-workflow.md) | Commit 格式与分支规范 |
| [docs/dev-phases.md](docs/dev-phases.md) | 各阶段开发目标 |

## 核心禁令

- 一次生成整个项目
- 未验证直接继续开发
- 随意切换技术栈
- `llm.invoke(user_input)` 直接调 AI
