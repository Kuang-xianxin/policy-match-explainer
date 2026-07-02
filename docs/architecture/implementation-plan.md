# 企业政策匹配网站实施计划

日期：2026-07-02

## 已确认方向

本项目目标是建设一个企业政策匹配网站：用户录入企业画像，系统根据政策库和匹配规则计算匹配结果，最后输出综合评估报告和建议。

已确认技术栈：

- 数据库：PostgreSQL
- 前端：TypeScript + Vue 3
- 后端：TypeScript + Express
- 匹配逻辑：企业画像不同字段按不同权重打分，输出匹配结果和综合评估报告
- 接口要求：类型必须规范，接口字段和关键字段类型要明确约束

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
- 建议用 schema 校验库生成或约束 API 类型，例如 Zod。是否采用需要确认。

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
  prisma/                # 数据库 schema 和迁移，是否使用 Prisma 待确认
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

注意：上面只是技术结构示例，具体字段和枚举值需要你确认后才能定稿。

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
- `enterprises`：企业画像。
- `match_runs`：一次匹配任务。
- `match_results`：每条政策的匹配结果。
- `reports`：综合报告内容和下载文件信息。

优先级：

1. 先建 `policies`、`policy_rules`、`enterprises`、`match_runs`、`match_results`。
2. 再补 `source_documents` 和 `policy_applications`。
3. 最后做 `reports` 的文件导出。

## 后端模块计划

### 第一阶段 API

- `GET /health`：健康检查。
- `GET /api/policies`：政策列表。
- `GET /api/policies/:id`：政策详情。
- `POST /api/enterprises`：保存企业画像。
- `POST /api/match-runs`：发起一次匹配。
- `GET /api/match-runs/:id`：查看匹配结果。
- `GET /api/reports/:matchRunId`：查看综合报告。

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

## 实施阶段计划

### 阶段 0：需求确认

完成待确认问题，不开始写业务代码。

输出：

- 确认后的字段清单
- 确认后的权重口径
- 确认后的报告格式
- 确认后的第一版政策范围

### 阶段 1：项目骨架

输出：

- Vue 3 + TypeScript 前端项目
- Express + TypeScript 后端项目
- 共享类型包
- PostgreSQL 连接配置
- 基础健康检查接口

### 阶段 2：数据库和类型

输出：

- 数据库 schema
- 迁移脚本
- DTO/schema 校验
- API 错误格式
- 本地开发环境配置

### 阶段 3：政策库 MVP

输出：

- 手工录入或种子数据导入若干政策
- 政策列表和详情 API
- 政策规则表
- 政策详情页面

### 阶段 4：企业画像和匹配引擎

输出：

- 企业画像表单
- 企业画像保存 API
- 规则评分函数
- 匹配结果保存
- 单元测试覆盖核心评分场景

### 阶段 5：报告生成

输出：

- 综合报告接口
- 报告页面
- Markdown/HTML 报告内容
- 后续再考虑 PDF 导出

### 阶段 6：部署

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

## 当前不确定问题

下面问题需要你确认，我不会直接替你猜：

1. 第一版政策范围：只做龙华区政策，还是要同时覆盖深圳市级、广东省级、国家级政策？
2. 企业画像字段：你希望用户填写哪些字段？例如注册地、经营地、行业、营收、纳税、社保人数、研发投入、资质荣誉、融资阶段、上市状态等，哪些必须有？
3. “关键字类型”具体指什么？是指 TypeScript 字段类型、政策关键词枚举、行业/标签枚举，还是接口文档中的关键词字段？
4. 权重口径：每个字段权重由你人工指定，还是系统先给默认权重再允许后台调整？
5. 硬性条件：哪些条件不满足时必须直接判定不能申报？例如注册地不在龙华区、政策已过期、行业不符。
6. 报告格式：第一版只要网页报告，还是必须支持 Word/PDF 下载？
7. 用户系统：第一版是否需要登录、保存历史企业画像和历史报告？
8. 政策数据来源：第一版是先手动录入样例政策，还是直接做龙华政策文件库采集？
9. 服务器配置：腾讯云轻量服务器的 CPU、内存、磁盘、系统版本是多少？
10. 管理后台：第一版是否需要管理员维护政策、规则和权重？

## 下一步建议

先回答“当前不确定问题”中的关键项。确认后再进入阶段 1，搭建 Vue 3 + Express + PostgreSQL 项目骨架。
