# policy-match-explainer

基于 TypeScript 的惠企政策智能匹配 Web 系统，第一版 MVP 覆盖深圳市龙华区政策匹配闭环。

## 技术栈

- 前端：Vue 3 + TypeScript + Vite
- 后端：Express + TypeScript
- 数据库：PostgreSQL
- 校验：Zod
- 匹配：规则权重评分 + DeepSeek 复核增强

## 企业画像输入方案

当前 MVP 的企业画像全部由用户手动填写，企业名称和统一社会信用代码也手动输入。画像输入页不再提供企业名称自动补全、AI 字段解耦或自动导入画像草稿。

DeepSeek 仍用于用户保存画像之后的政策匹配复核和文字报告生成。龙华区企业库可行性方案保留为后续可选研究，见：`docs/research/longhua-enterprise-registry-feasibility.md`。

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
