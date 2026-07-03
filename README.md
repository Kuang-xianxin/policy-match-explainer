# policy-match-explainer

基于 TypeScript 的惠企政策智能匹配 Web 系统，第一版 MVP 覆盖深圳市龙华区政策匹配闭环。

## 技术栈

- 前端：Vue 3 + TypeScript + Vite
- 后端：Express + TypeScript
- 数据库：PostgreSQL
- 校验：Zod
- 匹配：规则权重评分 + DeepSeek 复核增强

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

前端地址：http://localhost:5173

后端地址：http://localhost:4000

## 测试

```bash
npm test
npm run build
```

没有配置 `DEEPSEEK_API_KEY` 时，系统会使用明确标记为 `mock` 的本地 AI 结果，便于开发和测试。配置 API Key 后，后端会调用 DeepSeek Chat Completion API。
