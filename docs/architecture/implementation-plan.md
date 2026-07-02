# 企业政策匹配网站实施计划

日期：2026-07-03

## 已确认方向

本项目目标是建设一个企业政策匹配网站：用户注册登录后录入企业画像，系统根据龙华区政策库和匹配规则计算匹配结果，最后输出匹配解释和 DeepSeek 生成的文字版综合评估报告。

已确认技术栈：

- 数据库：PostgreSQL
- 前端：TypeScript + Vue 3
- 后端：TypeScript + Express
- 匹配逻辑：企业画像不同字段按不同权重打分，输出匹配结果和综合评估报告
- 接口要求：类型必须规范，接口字段和关键字段类型要明确约束
- API JSON 字段：使用 snake_case
- 请求校验：使用 Zod 做后端运行时校验
- 用户系统：第一版实现注册登录、历史企业画像和历史匹配记录保存
- 权限要求：每个用户只能看到自己的企业画像、匹配记录和报告
- 政策数据：第一版直接采集龙华政府在线政策文件库
- 报告方式：第一版输出网页文字报告，接入 DeepSeek API 辅助撰写，不做 Word/PDF 导出
- 规则维护：第一版通过代码和种子数据维护，不做管理后台

## 可行性评估

整体方案可行，而且技术栈匹配度较高。

### 前端 TypeScript + Vue 3

适合本项目的原因：

- 企业画像表单字段多，TypeScript 能减少字段名、枚举值、可空值错误。
- Vue 3 适合做分步骤表单、结果看板、报告预览、政策详情弹窗。
- 组合式 API 适合把企业画像、匹配结果、报告状态拆成清晰模块。

需要注意：

- 企业画像字段不要直接散落在页面组件里，应该由共享类型和表单 schema 驱动。
- 下拉项、标签、行业分类、企业资质等必须使用枚举或字面量联合类型，避免前后端写出不同字符串。

### 后端 TypeScript + Express

适合本项目的原因：

- Express 足够轻，适合第一版快速开发。
- TypeScript 能和前端共享 DTO、枚举、请求响应类型。
- 匹配逻辑可以先做成纯函数模块，方便测试，不和 HTTP 控制器混在一起。

需要注意：

- Express 本身不约束请求体类型，必须加运行时校验。
- 只写 TypeScript interface 不够，因为接口在运行时不存在，前端传错字段后端仍可能收到脏数据。
- 使用 Zod 约束 API 请求体、响应关键字段和枚举值，避免只依赖 TypeScript 编译期类型。

### PostgreSQL

适合本项目的原因：

- 政策、规则、企业画像、匹配结果、报告之间有清晰关系。
- 可以用普通表保存稳定字段，用 `jsonb` 保存原始抓取字段和用户输入快照。
- 后续可扩展全文搜索、标签索引、报表统计和审计追踪。

需要注意：

- 第一版不要过度依赖 `jsonb`，否则后面匹配查询会退化成大量应用层逻辑。
- 稳定参与匹配的字段必须结构化成列或规则表。
- 原始政策网页、原始企业画像快照可以保留在 `jsonb` 中用于追溯。

## 推荐总体架构

建议采用单仓库多模块结构：

```text
policy-match-explainer/
  apps/
    web/                 # Vue 3 前端
    api/                 # Express 后端
  packages/
    shared/              # 前后端共享类型、枚举、DTO、schema
    matcher/             # 政策匹配和评分逻辑
  prisma/                # 数据库 schema 和迁移，具体 ORM 仍可在编码前确认
  docs/
    architecture/
    research/
```

这种结构的好处：

- 前后端共享企业画像、政策标签、匹配结果等类型。
- 匹配算法独立成模块，便于单元测试和后续替换。
- 数据库迁移、API 服务、前端页面都能在同一项目内管理。

## API 和类型规范方案

### 目标

所有前后端接口都必须满足：

- 请求体字段有明确类型。
- 响应体字段有明确类型。
- 枚举值和关键字字段有固定取值范围。
- 后端运行时校验请求，不能只依赖 TypeScript 编译期类型。
- API 错误响应格式统一。

### 建议约束

关键字段类型建议统一放在 `packages/shared`：

```ts
export type RegionCode = 'longhua' | 'shenzhen' | 'guangdong' | 'national';
export type MatchLevel = 'eligible' | 'likely' | 'not_matched' | 'needs_more_info';
export type PolicyStatus = 'active' | 'expired' | 'unknown';
export type ApplicationStatus = 'open' | 'not_started' | 'closed' | 'unknown';
```

企业画像字段示例：

```ts
export interface EnterpriseProfileInput {
  name?: string;
  registeredRegion: string;
  operatingRegion?: string;
  industry: string;
  employeeCount?: number;
  annualRevenue?: number;
  rdExpense?: number;
  qualifications: string[];
  financingStage?: string;
  listedStatus?: string;
}
```

匹配结果字段示例：

```ts
export interface PolicyMatchResult {
  policyId: string;
  policyTitle: string;
  score: number;
  matchLevel: MatchLevel;
  matchedConditions: MatchedCondition[];
  missingConditions: MissingCondition[];
  riskNotes: string[];
  suggestedActions: string[];
}
```

注意：具体字段以 `docs/product/prd.md` 的 v0.2 已确认稿为准。

## 匹配评分方案

第一版建议采用“规则权重评分”，不要一开始做复杂机器学习。

### 基本流程

1. 用户提交企业画像。
2. 后端校验企业画像字段。
3. 根据区域、有效性、行业、申报状态先过滤候选政策。
4. 对每条候选政策读取规则列表。
5. 逐条规则计算命中、未命中、信息不足。
6. 按权重汇总得分。
7. 生成匹配等级和解释。
8. 保存本次输入快照、匹配结果和报告。

### 推荐评分模型

每条政策规则包含：

- `fieldKey`：对应企业画像字段
- `operator`：比较方式，例如 `equals`、`in`、`gte`、`lte`、`contains`
- `expectedValue`：期望值
- `weight`：权重
- `isRequired`：是否硬性条件
- `evidenceText`：政策原文依据

评分逻辑：

- 硬性条件不满足：该政策直接降级为“不匹配”或“需人工复核”。
- 普通条件命中：加对应权重。
- 普通条件缺失：不加分，并计入缺失条件。
- 用户未填写必要字段：标记为“需补充信息”，不直接判断为不匹配。

匹配等级建议：

- `eligible`：核心条件满足，分数达到阈值。
- `likely`：大部分条件满足，但存在少量缺失或需确认字段。
- `needs_more_info`：关键字段缺失，暂不能判断。
- `not_matched`：硬性条件不满足或分数明显不足。

阈值和权重需要你确认，不能直接替你定死。

## 数据库设计计划

沿用数据库选型文档中的方向，第一版建议建这些核心表：

- `source_documents`：政策原始抓取和解析追溯。
- `policies`：标准化政策主表。
- `policy_rules`：政策拆解后的匹配条件。
- `policy_applications`：申报窗口、申报入口和材料要求。
- `users`：注册用户。
- `enterprises`：企业画像。
- `match_runs`：一次匹配任务。
- `match_results`：每条政策的匹配结果。
- `reports`：DeepSeek 生成的文字版综合评估报告。

优先级：

1. 先建 `users`、`enterprises`、`policies`、`policy_rules`、`match_runs`、`match_results`。
2. 再补 `source_documents`、`policy_applications` 和龙华区政策采集脚本。
3. 最后接入 DeepSeek，生成并保存文字版 `reports`。

## 后端模块计划

### 第一阶段 API

- `GET /health`：健康检查。
- `POST /api/auth/register`：注册。
- `POST /api/auth/login`：登录。
- `POST /api/auth/logout`：退出。
- `GET /api/auth/me`：当前用户。
- `GET /api/policies`：政策列表。
- `GET /api/policies/:id`：政策详情。
- `POST /api/enterprises`：保存企业画像。
- `GET /api/enterprises`：当前用户企业画像列表。
- `POST /api/match-runs`：发起一次匹配。
- `GET /api/match-runs/:id`：查看匹配结果。
- `POST /api/match-runs/:id/report`：生成文字报告。
- `GET /api/match-runs/:id/report`：查看文字报告。

### 后端目录建议

```text
apps/api/src/
  app.ts
  server.ts
  routes/
  controllers/
  services/
  repositories/
  middleware/
  config/
packages/matcher/src/
  score-policy.ts
  evaluate-rule.ts
  explain-result.ts
```

## 前端页面计划

第一版页面建议：

1. 企业画像录入页
   - 基础信息
   - 行业与规模
   - 资质荣誉
   - 经营和财务字段
   - 申报意向或偏好

2. 匹配结果页
   - 总体评分
   - 可申报政策
   - 可能可申报政策
   - 需补充信息政策
   - 暂不匹配政策

3. 政策详情页
   - 政策摘要
   - 命中条件
   - 缺失条件
   - 申报入口
   - 原文链接

4. 综合报告页
   - 企业画像摘要
   - 匹配概览
   - 推荐政策列表
   - 风险提示
   - 下一步建议
   - DeepSeek 生成的文字版综合评估报告

5. 注册/登录页
   - 用户注册
   - 用户登录
   - 当前用户退出

6. 企业画像历史页
   - 只展示当前用户自己的企业画像
   - 支持基于历史画像再次发起匹配

## 实施阶段计划

### 阶段 1：项目骨架

输出：

- Vue 3 + TypeScript 前端项目
- Express + TypeScript 后端项目
- 共享类型包
- PostgreSQL 连接配置
- Zod 校验基础设施
- 基础健康检查接口

### 阶段 2：认证和用户隔离

输出：

- 注册、登录、退出、当前用户接口
- 密码哈希存储
- 鉴权中间件
- 用户资源 ownership 校验
- 用户 A 不能访问用户 B 的画像、匹配记录和报告

### 阶段 3：数据库和类型

输出：

- 数据库 schema
- 迁移脚本
- DTO/schema 校验
- API 错误格式
- 本地开发环境配置

### 阶段 4：政策库 MVP

输出：

- 龙华区政策文件库采集脚本
- 原始政策数据入库
- 标准化政策入库
- 种子规则数据
- 政策列表和详情 API
- 政策规则表
- 政策详情页面

### 阶段 5：企业画像和匹配引擎

输出：

- 企业画像表单
- 企业画像保存 API
- 企业画像历史列表
- 规则评分函数
- 匹配结果保存
- 单元测试覆盖核心评分场景

### 阶段 6：DeepSeek 文字报告

输出：

- DeepSeek API 后端封装
- 报告 prompt 模板
- 文字报告生成接口
- 报告保存和失败状态
- 报告页面

### 阶段 7：部署

输出：

- Docker Compose
- PostgreSQL 数据卷
- Nginx 反向代理
- `.env.example`
- 服务器部署步骤
- 数据库备份脚本

## 测试计划

必须优先测试匹配逻辑，而不是只测页面能不能打开。

测试重点：

- 必填硬性条件不满足时是否正确判为不匹配。
- 非硬性条件按权重加分是否正确。
- 企业画像缺字段时是否进入“需补充信息”。
- 分数边界值是否正确进入匹配等级。
- 报告中的命中条件和缺失条件是否来自同一次匹配结果。
- API 请求体字段错误时是否返回统一校验错误。
- 用户 A 不能查看用户 B 的企业画像、匹配结果和报告。
- DeepSeek API 调用失败时结构化匹配结果仍可查看。

## 剩余实施配置问题

产品方向已在 `docs/product/prd.md` 中确认。编码或部署前还需要确认：

1. 腾讯云轻量服务器配置：CPU、内存、磁盘、操作系统。
2. DeepSeek API Key：只放 `.env` 或服务器环境变量，不能提交仓库。
3. 登录态实现：JWT 或服务端 session。若用户不指定，编码前给出取舍建议。
4. ORM 选择：Prisma 或 Drizzle。若用户不指定，编码前给出取舍建议。

## 下一步建议

按 `docs/product/prd.md` v0.2 已确认稿进入阶段 1，搭建 Vue 3 + Express + PostgreSQL 项目骨架。
