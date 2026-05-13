# FoodFlow

AI Workflow 驱动的饮食记录与营养分析系统。上传食物图片，AI 自动识别营养成分并生成饮食建议。

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | Next.js 15 + React 19 + TypeScript + TailwindCSS + Recharts |
| 后端 | FastAPI + SQLAlchemy(async) + Pydantic v2 |
| 数据库 | PostgreSQL 16 |
| 缓存/队列 | Redis 7 |
| 异步任务 | Celery 5.x |
| OCR | PaddleOCR 3.x |
| AI | 阿里云百炼 (通义千问 qwen-plus) |

## MVP 核心链路

```
注册/登录 → 上传食物图片 → Celery 异步分析 →
  PaddleOCR 文字识别 → Food Parser 营养解析 →
  阿里云百炼 AI 总结 → 前端展示结果
```

## 项目结构

```
FoodFlow/
├── backend/
│   ├── app/
│   │   ├── api/v1/        # REST API (auth, foods, tasks, dashboard, statistics)
│   │   ├── core/           # 配置、安全、依赖注入
│   │   ├── db/             # SQLAlchemy session、base
│   │   ├── models/         # 7 个数据模型
│   │   ├── schemas/        # Pydantic 响应模型
│   │   ├── services/       # 业务逻辑 (OCR, Parser, AI, Dashboard, Statistics)
│   │   └── tasks/          # Celery 任务
│   ├── alembic/            # 数据库迁移
│   ├── scripts/            # smoke_test.py, debug_ocr.py, debug_parser.py
│   └── uploads/            # 上传图片存储
├── frontend/
│   └── src/app/            # Next.js App Router 页面
└── docs/                   # 架构、开发流程文档
```

## 环境变量

复制 `backend/.env.example` 为 `backend/.env`，关键配置：

```env
# 数据库 (本机 PostgreSQL)
DATABASE_URL=postgresql+asyncpg://postgres:123456@127.0.0.1:5432/foodflow_db

# Redis
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_DB=0

# JWT
SECRET_KEY=change-me-to-a-random-secret-key

# OCR 模式: mock | paddle
OCR_MODE=mock

# AI 模式: mock | bailian
AI_MODE=mock
BAILIAN_API_KEY=
BAILIAN_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
BAILIAN_MODEL=qwen-plus
```

## 本地启动

### 前置条件

- Python 3.12+
- Node.js 18+
- PostgreSQL 16（本机运行，端口 5432）
- Redis 7（本机运行，端口 6379）

```sql
-- 创建数据库
CREATE DATABASE foodflow_db;
```

### 启动顺序

```bash
# 1. 安装 Python 依赖
cd backend
python -m venv .venv
source .venv/bin/activate   # macOS/Linux
.venv\Scripts\activate      # Windows
pip install -r ../requirements.txt

# 2. 数据库迁移
alembic upgrade head

# 3. 安装前端依赖
cd ../frontend
npm install

# 4. 启动 Redis（如未运行）
redis-server

# 5. 启动 FastAPI（终端 1）
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# 6. 启动 Celery Worker（终端 2）
cd backend
celery -A app.worker worker --loglevel=info -P solo

# 7. 启动前端（终端 3）
cd frontend
npm run dev
```

启动后：
- 后端 API: http://127.0.0.1:8000
- API 文档: http://127.0.0.1:8000/docs
- 前端: http://localhost:3000

## 冒烟测试

```bash
cd backend
python scripts/smoke_test.py
```

自动完成：注册/登录 → 上传测试图片 → 轮询任务 → 校验分析结果 → 查询 records → 查询 dashboard → 查询每周统计。

## API 概览

| 接口 | 说明 |
|---|---|
| POST /api/auth/register | 手机号注册 |
| POST /api/auth/login | 手机号登录 |
| POST /api/foods/upload | 上传食物图片 |
| GET /api/foods?range=week | 记录列表 |
| GET /api/foods/{id} | 记录详情 |
| GET /api/tasks/{id} | 任务状态 |
| POST /api/tasks/{id}/retry | 重试任务 |
| GET /api/dashboard/summary | 仪表盘 |
| GET /api/statistics/weekly | 每周统计 |

完整 Swagger 文档：http://127.0.0.1:8000/docs

## 当前已完成功能

- [x] 手机号注册/登录 (JWT)
- [x] 图片上传 + 文件存储
- [x] PaddleOCR 真实文字识别
- [x] Food Parser 营养数据解析
- [x] 阿里云百炼 AI 营养总结
- [x] Redis AI Summary 缓存
- [x] AI 调用日志 (ai_logs)
- [x] 任务进度实时轮询
- [x] 仪表盘数据聚合
- [x] 每周统计真实聚合
- [x] Celery 异步任务队列
- [x] TypeScript 0 错误 + 生产构建通过
- [x] 端到端冒烟测试

## 后续计划

- [ ] Food Parser 接入真实食物数据库 (nutrition engine)
- [ ] 用户个人设置页
- [ ] 历史记录搜索/分页
- [ ] 移动端适配优化
- [ ] 单元测试覆盖
- [ ] CI/CD 流水线
