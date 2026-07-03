# policy-match-explainer

基于 TypeScript 的惠企政策智能匹配 Web 系统，第一版 MVP 覆盖深圳市龙华区政策匹配闭环。

## 技术栈

- 前端：Vue 3 + TypeScript + Vite
- 后端：Express + TypeScript
- 数据库：PostgreSQL
- 校验：Zod
- 匹配：规则权重评分 + DeepSeek 复核增强

## 本地数据库

项目的 Docker PostgreSQL 绑定到本机 `15432`，避免和电脑上已有的 PostgreSQL `5432` 冲突：

```bash
DATABASE_URL=postgres://policy_user:policy_password@localhost:15432/policy_match
```

如果看到 `policy_user Password 认证失败`，通常说明后端连到了本机已有 PostgreSQL，而不是项目容器。优先执行：

```bash
npm run db:up
npm run db:check
```

## 企业画像输入方案

当前 MVP 的企业画像采用“AI 辅助轻量生成 + 用户确认”的方式。用户输入企业名称或简称后，DeepSeek 负责生成规范化查询词；后端从本地龙华企业示例索引中返回候选企业；用户选择候选企业后，系统生成一份待确认画像草稿。

工商基础字段来自候选企业原始数据，业务摘要等低风险字段可由 DeepSeek/mock 解耦生成；营收、利润、纳税、研发投入、研发人员、项目预算等非公开字段通过区间选择补充，也可以选择未知。DeepSeek 仍用于用户保存画像之后的政策匹配复核和文字报告生成。龙华区企业库可行性方案见：`docs/research/longhua-enterprise-registry-feasibility.md`。

## 本地运行

1. 安装依赖：

```bash
npm install
```

2. 启动 PostgreSQL：

```bash
npm run db:up
npm run db:check
```

3. 初始化数据库：

```bash
npm run db:migrate
npm run db:seed
```

4. 启动前后端：

```bash
npm run dev
```

前端页面：

- 登录页：http://localhost:5173/login
- 企业画像页：http://localhost:5173/profile
- 匹配结果和报告页：http://localhost:5173/results

后端地址：http://localhost:4000

## 测试

```bash
npm test
npm run build
```

## DeepSeek API Key

仓库只保留空占位，不写入真实 key：

```bash
DEEPSEEK_API_KEY=
DEEPSEEK_API_KET=
DEEPSEEK_TIMEOUT_MS=15000
```

你可以复制 `.env.example` 为 `.env`，然后在本地 `.env` 中填写自己的 key。也可以直接设置 Windows 用户/系统环境变量，后端会优先读取 `DEEPSEEK_API_KET`，再读取标准拼写 `DEEPSEEK_API_KEY`。没有配置 key 时，系统会使用明确标记为 `mock` 的本地 AI 结果，便于开发和测试。配置 API Key 后，后端会调用 DeepSeek Chat Completion API；如果调用超时或返回 JSON 不完整，会自动降级为 mock 结果，保证匹配流程不中断。
