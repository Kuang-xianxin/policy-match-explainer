# policy-match-explainer

面向企业用户的龙华区惠企政策匹配与解释系统。用户注册登录后，可以维护企业画像、发起政策匹配、查看规则命中情况、AI 复核说明，并生成一份可读的综合评估报告。

当前版本聚焦深圳市龙华区政策场景，目标不是替代政府申报系统，而是在正式申报前帮助企业判断：

- 哪些政策更值得优先关注。
- 当前企业画像为什么匹配或不匹配某项政策。
- 还缺哪些企业信息、资质或证明材料。
- 下一步应该如何准备申报材料。

## 核心能力

### 1. 用户与数据隔离

- 支持注册、登录、退出。
- 企业画像、匹配记录、报告都绑定当前用户。
- 后端接口会校验资源归属，避免用户通过猜测 ID 访问其他账号的数据。

### 2. 企业画像

系统支持两种方式准备企业画像：

- 手动填写企业信息。
- 输入企业名称或简称，由后端调用配置的数据源和 AI 能力检索候选企业，用户确认后再生成画像草稿。

企业名称自动补全遵循证据优先原则：

- AI 可以辅助规划查询、归纳业务方向、生成解释。
- 工商主体事实必须来自授权数据源、公开证据或本地维护的可信索引。
- 如果无法确认是深圳市龙华区企业，系统会硬拦截，不会生成“待确认主体”或默认龙华区草稿。
- 营收、利润、纳税、研发投入、项目预算等内部经营数据不能由大模型编造，需要用户选择区间、填写真实值，或标记为未知。

### 3. 政策匹配

匹配采用“两段式”设计：

1. 规则基线：根据政策硬性条件、字段权重和企业画像计算可解释分数。
2. AI 复核：DeepSeek 读取企业画像、规则命中结果和政策信息，补充语义解释、缺失信息和建议动作。

最终页面会同时展示规则基线、AI 复核和最终结论，方便追溯为什么推荐或不推荐。

### 4. 综合报告

匹配完成后可以生成文字版综合报告，内容包括：

- 综合结论。
- 申报优先级。
- 可行建议。
- 材料准备清单。
- 风险与限制。

报告会保存到当前账号下，后续重新进入匹配结果页可以继续查看。

### 5. 龙华区政策库

项目包含本地政策表和公开政策采集命令。政策数据分两层保存：

- `source_documents`：公开网页、申报指南、部门公告、政策解读等原始来源。
- `policies`：适合参与企业画像匹配的结构化政策记录和规则。

公开政策采集命令只访问公开页面，不绕过登录、验证码、企业认证或反爬限制。

## 技术栈

- 前端：Vue 3 + TypeScript + Vite
- 后端：Express + TypeScript
- 数据库：PostgreSQL
- 运行时校验：Zod
- AI：DeepSeek 用于政策复核和报告生成；豆包 Ark 可用于企业信息联网检索
- 测试：Vitest + Supertest
- 包管理：npm workspaces

## 项目结构

```text
apps/
  api/        Express 后端服务、数据库脚本、政策采集脚本
  web/        Vue 3 前端页面
packages/
  shared/     前后端共享类型和 Zod schema
  matcher/    确定性政策匹配规则引擎
  ai/         DeepSeek / 豆包调用封装和报告生成逻辑
docs/
  architecture/  架构与实现计划
  operations/    运维和采集说明
  product/       PRD
  research/      数据源、价格和可行性调研
```

## 环境要求

建议本地环境：

- Node.js 22 或更高版本。
- npm。
- Docker Desktop，用于启动本地 PostgreSQL。
- 可选：DeepSeek API Key，用于真实 AI 复核和报告生成。
- 可选：火山引擎 Ark API Key，用于豆包联网企业检索。

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 准备环境变量

复制环境变量示例：

```bash
copy .env.example .env
```

macOS / Linux 可使用：

```bash
cp .env.example .env
```

最小本地配置如下：

```bash
DATABASE_URL=postgres://policy_user:policy_password@localhost:15432/policy_match
API_PORT=4000
CORS_ORIGIN=http://localhost:5173
VITE_API_BASE_URL=http://localhost:4000
```

AI 相关配置：

```bash
DEEPSEEK_API_KEY=
DEEPSEEK_MODEL=deepseek-v4-flash
DEEPSEEK_TIMEOUT_MS=15000
MATCH_REVIEW_CONCURRENCY=3

ARK_API_KEY=
DOUBAO_MODEL=doubao-seed-2-0-mini-260428
DOUBAO_BASE_URL=https://ark.cn-beijing.volces.com/api/v3/responses
DOUBAO_TIMEOUT_MS=45000
```

说明：

- `DEEPSEEK_API_KEY` 用于政策匹配复核和综合报告生成。
- 历史兼容变量 `DEEPSEEK_API_KET` 仍可被读取，但新配置建议使用 `DEEPSEEK_API_KEY`。
- `ARK_API_KEY` 是豆包 Ark 的推荐变量名，`DOUBAO_API_KEY` 仅作为兼容别名。
- 如果不配置 AI Key，系统会使用明确标记为 `mock` 的本地结果，方便开发和演示。
- 不要把真实 Key 提交到仓库。

### 3. 启动 PostgreSQL

项目使用 Docker PostgreSQL，并绑定到本机 `15432` 端口，避免和电脑上已有的 PostgreSQL `5432` 冲突。

```bash
npm run db:up
npm run db:check
```

如果看到 `policy_user Password authentication failed`，优先确认后端连接的是项目容器：

```bash
npm run db:up
npm run db:check
```

默认数据库连接为：

```bash
postgres://policy_user:policy_password@localhost:15432/policy_match
```

### 4. 初始化数据库

```bash
npm run db:migrate
npm run db:seed
```

`db:seed` 会写入基础演示政策和规则，便于本地立即体验匹配流程。

### 5. 启动开发服务

```bash
npm run dev
```

启动后访问：

- 前端首页 / 登录页：http://localhost:5173/login
- 企业画像页：http://localhost:5173/profile
- 匹配结果和报告页：http://localhost:5173/results
- 后端健康检查：http://localhost:4000/health
- AI 配置状态：http://localhost:4000/api/ai/status

## 如何使用

1. 打开 `http://localhost:5173/login`。
2. 注册一个新账号并登录。
3. 进入企业画像页。
4. 选择手动填写企业画像，或输入企业名称检索候选企业。
5. 确认企业主体和画像字段，补充营收、纳税、研发、项目预算等非公开字段。
6. 点击保存并匹配。
7. 在结果页查看每条政策的规则基线、AI 复核和最终结论。
8. 点击生成综合评估报告，查看申报优先级、材料清单和风险提示。

## 常用命令

```bash
# 启动本地 PostgreSQL
npm run db:up

# 检查数据库连接
npm run db:check

# 执行数据库迁移
npm run db:migrate

# 写入种子数据
npm run db:seed

# 启动前后端开发服务
npm run dev

# 运行全部测试
npm test

# 构建全部包和应用
npm run build
```

## 龙华区公开政策采集

在数据库已启动并完成迁移后，可以运行：

```bash
npm run db:collect:longhua
```

采集结果会写入：

- `source_documents`：原始来源和抽取文本。
- `policies`：可参与匹配的政策记录。

更多说明见：

- `docs/operations/longhua-policy-collection.md`
- `docs/research/longhua-policy-channels.md`

注意：采集脚本只处理公开可访问页面。如果本地网络、DNS、代理或 TLS 环境导致访问失败，可以在服务器或正常网络环境中运行采集命令，并如实记录采集状态。

## 测试

运行全部测试：

```bash
npm test
```

运行构建：

```bash
npm run build
```

常见分包测试：

```bash
npm run test -w @policy-match/matcher
npm run test -w @policy-match/ai
npm run test -w @policy-match/api
npm run test -w @policy-match/web
```

## 主要 API

认证：

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

企业画像：

- `POST /api/company-lookup/search`
- `POST /api/company-lookup/:id/generate-profile`
- `POST /api/enterprise-profiles`
- `GET /api/enterprise-profiles`
- `GET /api/enterprise-profiles/:id`

政策与匹配：

- `GET /api/policies`
- `POST /api/match-runs`
- `GET /api/match-runs`
- `GET /api/match-runs/:id`
- `POST /api/match-runs/:id/report`
- `GET /api/match-runs/:id/report`

状态：

- `GET /health`
- `GET /api/ai/status`

## 数据和安全边界

- DeepSeek 不作为企业工商事实数据源。
- 大模型不能编造营收、利润、纳税、研发投入、社保、项目预算等内部数据。
- 政策匹配以规则基线为主，AI 只做复核、解释和报告增强。
- 硬性条件失败时，AI 不能把结果改成推荐。
- 真实 API Key 只能放在本地 `.env`、Windows 环境变量或服务器环境变量中。
- 用户资源必须始终按 `user_id` 隔离。

## 生产部署提示

本项目可以部署到一台云服务器上，推荐形态：

- PostgreSQL 使用 Docker 或服务器托管服务。
- Express API 以 systemd、PM2 或容器方式运行。
- Vue 前端先执行 `npm run build`，再由 Nginx 托管 `apps/web/dist`。
- 服务器环境变量中配置 `DATABASE_URL`、`DEEPSEEK_API_KEY`、`ARK_API_KEY` 等敏感信息。

部署前至少执行：

```bash
npm test
npm run build
```

## 更多文档

- 产品需求：`docs/product/prd.md`
- 数据库选型：`docs/architecture/policy-database-selection.md`
- 实现计划：`docs/architecture/implementation-plan.md`
- 企业画像数据源调研：`docs/research/enterprise-profile-data-sources.md`
- 企业库可行性：`docs/research/longhua-enterprise-registry-feasibility.md`
- 政策采集说明：`docs/operations/longhua-policy-collection.md`

## 当前版本边界

- 当前重点是龙华区政策匹配，不覆盖全部深圳市、省级或国家级政策。
- 政策规则仍需要持续结构化和校准，采集到的原始政策文本不等于已经全部可高置信匹配。
- 企业自动补全依赖可用的数据源和证据质量，无法确认主体时会阻止进入匹配。
- 报告是申报前辅助分析，不是政府部门审核结论。
