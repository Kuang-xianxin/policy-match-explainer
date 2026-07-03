# policy-match-explainer

基于 TypeScript 的惠企政策智能匹配 Web 系统，第一版 MVP 覆盖深圳市龙华区政策匹配闭环。

## 技术栈

- 前端：Vue 3 + TypeScript + Vite
- 后端：Express + TypeScript
- 数据库：PostgreSQL
- 校验：Zod
- 匹配：规则权重评分 + DeepSeek 复核增强

## 企业查询画像方案

第一版不让 DeepSeek 直接“生成”企业事实。推荐流程是：

1. 用户输入企业名称。
2. DeepSeek 只生成查询计划：规范企业名、拆分关键词、建议数据源。
3. 后端 provider 调用真实数据源获取企业原始记录，例如官方开放数据、企查查等商业企业库，或后续自建采集库。
4. DeepSeek 基于 provider 返回的 `raw_payload` 做字段解耦，生成企业画像草稿和字段来源说明。
5. 用户确认画像后再保存、匹配政策、生成报告。

当前 MVP 只有 `MVP demo company registry` 演示 provider。没有命中的企业不会返回假候选；真实上线前需要接入正式企业数据源。

龙华区企业库可行性方案见：`docs/research/longhua-enterprise-registry-feasibility.md`。

## 本地运行

1. 安装依赖：

```bash
npm install
```

2. 启动 PostgreSQL：

```bash
npm run db:up
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
```

你可以复制 `.env.example` 为 `.env`，然后在本地 `.env` 中填写自己的 key。也可以直接设置 Windows 用户/系统环境变量，后端会优先读取 `DEEPSEEK_API_KET`，再读取标准拼写 `DEEPSEEK_API_KEY`。没有配置 key 时，系统会使用明确标记为 `mock` 的本地 AI 结果，便于开发和测试。配置 API Key 后，后端会调用 DeepSeek Chat Completion API。
