# 企业政策匹配解释网站 PRD

版本：v0.1 待确认稿

日期：2026-07-02

## 1. 项目背景

企业政策信息分散在政府门户、部门通知、申报指南和政策解读中。企业用户往往不知道自己是否符合某项惠企政策，也不清楚哪些条件已经满足、哪些条件需要补充。

本项目建设一个面向龙华区惠企政策的匹配网站。用户填写企业画像后，系统根据政策库和规则权重进行匹配评分，输出政策匹配结果、命中原因、缺失条件和行动建议。

## 2. 第一版范围

### 2.1 范围内

- 只覆盖龙华区政策。
- 支持企业画像录入。
- 支持政策规则匹配和权重评分。
- 支持查看匹配结果。
- 支持查看每条政策的命中条件、缺失条件、风险提示和建议动作。
- 支持网页内展示综合评估内容。
- 使用 PostgreSQL 存储政策、规则、企业画像和匹配结果。
- 前端使用 TypeScript + Vue 3。
- 后端使用 TypeScript + Express。
- 接口类型、字段类型、枚举值和关键字段必须规范定义。

### 2.2 范围外

- 第一版不覆盖深圳市级、广东省级、国家级政策。
- 第一版不做 Word/PDF 报告导出。
- 第一版不做机器学习预测。
- 第一版不做复杂语义向量检索。
- 第一版不默认实现用户登录，除非后续确认需要。
- 第一版不默认实现完整管理后台，政策和规则维护方式待确认。

## 3. 用户与场景

### 3.1 目标用户

- 想了解龙华区惠企政策匹配情况的企业负责人或行政/财务/项目申报人员。
- 做政策咨询、企业服务或项目申报辅助的工作人员。
- 项目演示、作品集或课程答辩场景中的评审用户。

### 3.2 核心使用场景

1. 用户打开网站。
2. 用户填写企业画像。
3. 用户提交画像。
4. 系统计算各项政策匹配分数。
5. 系统返回匹配结果列表。
6. 用户查看推荐政策、命中原因、缺失条件和下一步建议。

## 4. 产品目标

第一版目标不是替代政府申报系统，而是提供政策匹配解释和申报前判断。

核心目标：

- 帮用户快速知道“哪些龙华区政策可能适合我”。
- 帮用户理解“为什么匹配/为什么不匹配”。
- 帮用户知道“还缺哪些条件或材料方向”。
- 为后续真实政策采集和部署打好数据模型与接口基础。

## 5. 企业画像字段

字段分为必填字段和选填字段。必填字段用于第一版匹配基础判断；选填字段用于提高匹配准确率和解释质量。

### 5.1 必填字段

| 模块 | 字段名 | TypeScript 类型 | 作用 |
| --- | --- | --- | --- |
| 基础信息 | `company_name` | `string` | 企业名称，结果展示用 |
| 基础信息 | `credit_code` | `string` | 统一社会信用代码，企业唯一标识 |
| 基础信息 | `city` | `string` | 判断是否属于深圳市政策范围 |
| 基础信息 | `district` | `string` | 判断是否符合区级政策，如龙华区 |
| 基础信息 | `registered_year` | `number` | 判断企业成立年限 |
| 基础信息 | `listed_status` | `string` | 判断是否上市，影响中小企业类政策 |
| 基础信息 | `employee_count` | `number` | 判断企业规模 |
| 业务信息 | `industry` | `string` | 判断是否属于政策扶持行业 |
| 业务信息 | `main_business` | `string` | 描述主营业务，用于解释匹配原因 |
| 业务信息 | `main_products` | `string[]` | 判断产品方向是否符合政策 |
| 业务信息 | `customer_type` | `string[]` | 如政府客户、企业客户、个人客户 |
| 业务信息 | `business_model` | `string` | 判断业务模式，如 B2B、B2G、SaaS |
| 盈利信息 | `main_revenue_source` | `string` | 判断收入来源是否清晰 |
| 盈利信息 | `revenue_last_year` | `number` | 判断营收门槛 |
| 盈利信息 | `profit_last_year` | `number` | 判断经营状况 |
| 盈利信息 | `tax_paid_last_year` | `number` | 判断纳税贡献 |
| 研发创新 | `rd_expense_last_year` | `number` | 判断研发投入金额 |
| 研发创新 | `rd_expense_ratio` | `number` | 判断研发投入占比 |
| 研发创新 | `rd_employee_count` | `number` | 判断研发人员规模 |
| 研发创新 | `is_high_tech_enterprise` | `boolean` | 判断是否高新技术企业 |
| 研发创新 | `is_tech_sme` | `boolean` | 判断是否科技型中小企业 |
| 研发创新 | `has_specialized_new_sme` | `boolean` | 判断是否专精特新 |
| 研发创新 | `patent_count` | `number` | 判断知识产权能力 |
| 研发创新 | `software_copyright_count` | `number` | 软件企业/数字经济类政策常用 |
| 合规信息 | `tax_credit_level` | `string` | 税务信用等级 |
| 合规信息 | `has_major_violation` | `boolean` | 有重大违法一般直接不推荐 |
| 合规信息 | `social_security_normal` | `boolean` | 判断社保缴纳是否正常 |
| 申报项目 | `apply_project_name` | `string` | 本次申报项目名称 |
| 申报项目 | `project_direction` | `string` | 项目方向，如 AI、数据治理、智能制造 |
| 申报项目 | `project_stage` | `string` | 研发中、已落地、规模化推广 |
| 申报项目 | `project_budget` | `number` | 判断项目投入规模 |

### 5.2 建议选填字段

下面字段不作为第一版强制填写，但建议保留在类型定义和数据库扩展字段中。

| 模块 | 字段名 | TypeScript 类型 | 作用 |
| --- | --- | --- | --- |
| 基础信息 | `registered_capital` | `number` | 判断企业资本规模 |
| 基础信息 | `business_address` | `string` | 判断实际经营地 |
| 基础信息 | `is_headquarters` | `boolean` | 总部经济类政策可能使用 |
| 基础信息 | `is_above_scale_enterprise` | `boolean` | 规上企业政策常用 |
| 业务信息 | `export_amount_last_year` | `number` | 外贸类政策可能使用 |
| 业务信息 | `digital_transformation_status` | `string` | 数字化改造类政策使用 |
| 业务信息 | `has_government_procurement_experience` | `boolean` | 政府客户和 B2G 项目解释使用 |
| 盈利信息 | `revenue_growth_rate` | `number` | 判断增长型企业 |
| 盈利信息 | `asset_total` | `number` | 企业规模判断 |
| 研发创新 | `has_rd_center` | `boolean` | 创新平台类政策可能使用 |
| 研发创新 | `standard_participation_count` | `number` | 标准制定类奖励可能使用 |
| 研发创新 | `award_titles` | `string[]` | 荣誉资质类匹配 |
| 合规信息 | `credit_blacklist` | `boolean` | 严重失信直接降级 |
| 合规信息 | `environment_penalty_count` | `number` | 环保处罚风险提示 |
| 申报项目 | `project_start_date` | `string` | 判断项目周期 |
| 申报项目 | `project_end_date` | `string` | 判断项目周期 |
| 申报项目 | `project_invested_amount` | `number` | 判断已投入金额 |
| 申报项目 | `expected_subsidy_amount` | `number` | 申报预期展示 |

### 5.3 字段处理原则

- 必填字段如果为空，前端不允许提交。
- 数字字段必须校验为非负数，比例字段需约束合理范围。
- 布尔字段必须明确为 `true` 或 `false`，不能用空字符串代替。
- 多选字段统一用 `string[]`。
- 第一版使用中文展示名，但代码字段名统一使用 snake_case。
- 关键枚举字段应逐步收敛为固定取值，不能长期使用任意字符串。

## 6. 字段枚举初稿

下面枚举为第一版建议，后续可以按真实政策规则调整。

```ts
export type City = '深圳市';

export type District = '龙华区';

export type ListedStatus =
  | 'unlisted'
  | 'listed'
  | 'new_third_board'
  | 'pre_listing'
  | 'unknown';

export type CustomerType =
  | 'government'
  | 'enterprise'
  | 'individual'
  | 'overseas'
  | 'other';

export type BusinessModel =
  | 'B2B'
  | 'B2G'
  | 'B2C'
  | 'SaaS'
  | 'platform'
  | 'manufacturing'
  | 'service'
  | 'other';

export type TaxCreditLevel = 'A' | 'B' | 'M' | 'C' | 'D' | 'unknown';

export type ProjectStage =
  | 'planning'
  | 'researching'
  | 'developing'
  | 'launched'
  | 'scaling';

export type MatchLevel =
  | 'recommended'
  | 'potential'
  | 'need_more_info'
  | 'not_recommended';
```

## 7. 权重分配初稿

你已确认“权重先按系统理解分配，后续再手动调整”。第一版采用模块总权重 100 分。

| 模块 | 权重 | 说明 |
| --- | ---: | --- |
| 基础信息 | 20 | 判断地域、成立年限、规模、企业身份 |
| 业务信息 | 20 | 判断行业、主营业务、产品方向、客户类型 |
| 盈利信息 | 15 | 判断营收、利润、纳税贡献 |
| 研发创新 | 25 | 龙华区产业和科创类政策通常高度相关 |
| 合规信息 | 10 | 违法、信用、社保等作为风险和硬性条件 |
| 申报项目 | 10 | 判断本次项目方向、阶段和投入规模 |

### 7.1 基础信息权重

| 字段 | 权重 | 说明 |
| --- | ---: | --- |
| `city` | 4 | 是否深圳市 |
| `district` | 6 | 是否龙华区，区级政策核心条件 |
| `registered_year` | 3 | 判断成立年限 |
| `listed_status` | 2 | 判断上市/中小企业相关政策 |
| `employee_count` | 5 | 判断企业规模 |

`company_name` 和 `credit_code` 用于展示和唯一标识，不直接计分。

### 7.2 业务信息权重

| 字段 | 权重 | 说明 |
| --- | ---: | --- |
| `industry` | 7 | 是否属于政策扶持行业 |
| `main_business` | 4 | 用于解释业务匹配原因 |
| `main_products` | 4 | 判断产品方向 |
| `customer_type` | 2 | 判断 B2G、企业服务等方向 |
| `business_model` | 3 | 判断 SaaS、制造、平台等模式 |

### 7.3 盈利信息权重

| 字段 | 权重 | 说明 |
| --- | ---: | --- |
| `main_revenue_source` | 2 | 收入来源是否清晰 |
| `revenue_last_year` | 5 | 是否达到营收门槛 |
| `profit_last_year` | 3 | 经营状况 |
| `tax_paid_last_year` | 5 | 纳税贡献 |

### 7.4 研发创新权重

| 字段 | 权重 | 说明 |
| --- | ---: | --- |
| `rd_expense_last_year` | 4 | 研发投入金额 |
| `rd_expense_ratio` | 4 | 研发投入强度 |
| `rd_employee_count` | 3 | 研发人员规模 |
| `is_high_tech_enterprise` | 4 | 高企资质 |
| `is_tech_sme` | 3 | 科技型中小企业 |
| `has_specialized_new_sme` | 4 | 专精特新资质 |
| `patent_count` | 2 | 专利能力 |
| `software_copyright_count` | 1 | 软件著作权 |

### 7.5 合规信息权重

| 字段 | 权重 | 说明 |
| --- | ---: | --- |
| `tax_credit_level` | 3 | 税务信用 |
| `has_major_violation` | 4 | 重大违法，一般直接不推荐 |
| `social_security_normal` | 3 | 社保正常缴纳 |

### 7.6 申报项目权重

| 字段 | 权重 | 说明 |
| --- | ---: | --- |
| `apply_project_name` | 1 | 展示和报告摘要 |
| `project_direction` | 4 | 项目方向是否符合政策 |
| `project_stage` | 2 | 判断成熟度 |
| `project_budget` | 3 | 判断投入规模 |

## 8. 匹配等级

第一版匹配等级建议：

| 等级 | 分数/条件 | 展示含义 |
| --- | --- | --- |
| `recommended` | 80 分及以上，且无硬性条件失败 | 推荐关注 |
| `potential` | 60-79 分，或存在少量信息缺口 | 可能匹配 |
| `need_more_info` | 关键字段缺失，无法判断 | 需补充信息 |
| `not_recommended` | 低于 60 分，或硬性条件失败 | 暂不推荐 |

硬性条件失败优先级高于分数。

## 9. 硬性条件初稿

以下条件如果不满足，相关政策应直接降级为 `not_recommended` 或 `need_more_info`：

- 政策限定龙华区，但企业 `district` 不是龙华区。
- 政策限定深圳市，但企业 `city` 不是深圳市。
- 政策已过期或申报窗口已关闭。
- 政策要求无重大违法，但 `has_major_violation = true`。
- 政策要求特定行业，但企业行业明显不符。
- 政策要求特定资质，例如高新技术企业、专精特新、科技型中小企业，但企业未具备。

如果字段为空，优先标记 `need_more_info`，不要误判为不匹配。

## 10. 核心页面

### 10.1 企业画像录入页

模块：

- 基础信息
- 业务信息
- 盈利信息
- 研发创新
- 合规信息
- 申报项目

要求：

- 按模块分组填写。
- 必填字段有明确标识。
- 类型错误实时提示。
- 提交前做完整校验。

### 10.2 匹配结果页

展示：

- 总体匹配概览。
- 推荐关注政策。
- 可能匹配政策。
- 需补充信息政策。
- 暂不推荐政策。
- 每条政策展示分数、等级、核心命中原因、主要缺失条件。

### 10.3 政策详情/解释页

展示：

- 政策标题。
- 政策来源链接。
- 匹配分数。
- 命中条件。
- 缺失条件。
- 风险提示。
- 建议动作。

### 10.4 综合评估内容

第一版只在网页展示，不导出 Word/PDF。

内容：

- 企业画像摘要。
- 匹配总体结论。
- 推荐政策列表。
- 需补充信息。
- 风险提示。
- 下一步建议。

## 11. API 初稿

### 11.1 健康检查

- `GET /health`

### 11.2 企业画像

- `POST /api/enterprise-profiles`
- `GET /api/enterprise-profiles/:id`

### 11.3 政策

- `GET /api/policies`
- `GET /api/policies/:id`

### 11.4 匹配

- `POST /api/match-runs`
- `GET /api/match-runs/:id`

### 11.5 综合评估

- `GET /api/match-runs/:id/assessment`

## 12. TypeScript 接口规范

### 12.1 命名规范

- 数据库字段使用 snake_case。
- TypeScript 类型和接口使用 PascalCase。
- API JSON 字段第一版使用 snake_case，和数据库/PRD 字段保持一致，减少转换成本。
- 枚举值使用小写 snake_case 或明确英文常量，不混用中文。

### 12.2 类型规范

- 请求体、响应体、枚举、错误结构必须统一定义在共享包中。
- 后端必须进行运行时校验。
- 前端表单必须复用共享 schema 或共享类型。
- 金额字段单位统一为“元”。
- 比例字段统一使用百分比数值，例如 `12.5` 表示 12.5%。
- 年份字段如 `registered_year` 使用四位年份，例如 `2021`。

### 12.3 错误响应

统一错误响应格式：

```ts
export interface ApiErrorResponse {
  error_code: string;
  message: string;
  details?: unknown;
}
```

## 13. 数据库核心表

第一版建议表：

- `policies`
- `policy_rules`
- `enterprise_profiles`
- `match_runs`
- `match_results`
- `policy_applications`
- `source_documents`

第一版可以先不建 `reports` 表，因为你已确认不需要报告导出。综合评估内容可以由匹配结果实时生成，或保存在 `match_runs.assessment_snapshot` 中。

## 14. 非功能需求

### 14.1 可维护性

- 匹配逻辑必须独立于 Express 路由。
- 权重配置必须集中管理，不能散落在页面或 controller 中。
- 字段定义必须集中管理，便于后续调整。

### 14.2 可测试性

必须为匹配逻辑写单元测试：

- 地区不符。
- 重大违法。
- 高企资质命中。
- 专精特新命中。
- 研发投入比例命中。
- 字段缺失进入 `need_more_info`。
- 分数边界进入正确等级。

### 14.3 可部署性

- 使用 `.env` 管理数据库连接。
- 支持本地开发和腾讯云轻量服务器部署。
- 后续使用 Docker Compose 部署 PostgreSQL、API 和前端。

## 15. 里程碑

### M1：项目骨架

- 前端 Vue 3 + TypeScript。
- 后端 Express + TypeScript。
- 共享类型包。
- PostgreSQL 连接。
- 健康检查接口。

### M2：企业画像和类型规范

- 企业画像表单。
- 字段校验。
- API 类型定义。
- 保存企业画像。

### M3：政策和规则 MVP

- 政策表。
- 规则表。
- 种子政策数据。
- 政策列表和详情。

### M4：匹配引擎

- 权重配置。
- 规则计算。
- 匹配等级。
- 结果保存。
- 单元测试。

### M5：结果展示

- 匹配结果页。
- 政策解释页。
- 综合评估内容。

### M6：部署准备

- Docker Compose。
- 环境变量模板。
- 服务器部署文档。
- 数据库备份说明。

## 16. 待确认项

在开始写代码前，需要你确认以下 PRD 点：

1. API JSON 字段是否确认使用 snake_case，而不是前端常见 camelCase？
2. `city` 和 `district` 第一版是否固定为 `深圳市`、`龙华区`，还是允许用户选择其他值后给出不匹配提示？
3. 第一版是否需要保存历史企业画像和历史匹配记录？
4. 第一版政策数据是先用种子数据手工录入，还是直接做龙华政策文件库采集？
5. 第一版是否需要管理员页面来调整政策规则和权重，还是先通过代码/种子数据维护？
6. 是否确认使用 Zod 做接口运行时校验？如果不确认，我会在编码前再给你比较方案。
