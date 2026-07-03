# 企业政策匹配解释网站 PRD

版本：v0.5 AI 辅助轻量画像稿

日期：2026-07-03

## 0. 最新调整

当前 MVP 的企业画像改为“AI 辅助轻量画像”。用户输入企业名称或简称，DeepSeek 只负责生成规范化查询词；后端从本地龙华企业示例索引或后续授权数据源返回候选企业；用户必须选择候选企业后，系统才能生成待确认画像草稿。

工商基础字段来自候选企业原始数据，业务摘要、产品方向、客户类型、业务模式和项目方向允许 DeepSeek 做低风险推断并标记来源。营收、利润、纳税、研发投入、研发人员、项目预算等非公开字段不能由大模型编造，当前 MVP 通过区间选择补充，并允许选择 `unknown`。DeepSeek 继续用于用户保存画像之后的政策匹配复核、解释增强和文字报告生成。

## 1. 项目背景

企业政策信息分散在政府门户、部门通知、申报指南和政策解读中。企业用户往往不知道自己是否符合某项惠企政策，也不清楚哪些条件已经满足、哪些条件需要补充。

本项目建设一个面向龙华区惠企政策的匹配网站。用户注册登录后填写企业画像，或输入企业名称生成画像草稿。系统基于龙华区政策文件库、结构化政策规则、字段权重和 DeepSeek API 进行匹配分析，输出政策匹配结果、命中原因、缺失条件、风险提示，并接入 DeepSeek API 生成文字版综合评估报告。

## 2. 第一版范围

### 2.1 范围内

- 只覆盖龙华区政策。
- 固定按深圳市龙华区场景设计，`city = 深圳市`，`district = 龙华区`。
- 支持用户注册、登录、退出。
- 支持用户级数据隔离，每个用户只能查看自己的企业画像、匹配记录和报告。
- 支持企业画像录入和历史画像保存。
- 支持企业名称查询自动补全企业画像草稿，用户确认后再保存和匹配。
- 支持 DeepSeek 对公开数据源返回内容进行字段解耦，生成结构化企业画像草稿。
- 支持从龙华政府在线政策文件库采集政策数据。
- 支持政策规则匹配和权重评分。
- 支持 DeepSeek 对规则匹配结果进行复核、解释增强和补充建议。
- 支持查看匹配结果。
- 支持查看每条政策的命中条件、缺失条件、风险提示和建议动作。
- 支持接入 DeepSeek API，基于匹配结果生成文字版综合评估报告。
- 使用 PostgreSQL 存储用户、政策、规则、企业画像、匹配结果和报告文本。
- 前端使用 TypeScript + Vue 3。
- 后端使用 TypeScript + Express。
- 使用 Zod 做后端接口运行时校验。
- API JSON 字段使用 snake_case。
- 接口类型、字段类型、枚举值和关键字段必须规范定义。
- 第一版政策规则和权重先通过代码/种子数据维护，不做管理后台。

### 2.2 范围外

- 第一版不覆盖深圳市级、广东省级、国家级政策。
- 第一版不做 Word/PDF 报告导出。
- 第一版不做机器学习预测。
- 第一版不做复杂语义向量检索。
- 第一版不做管理员可视化后台。
- 第一版不让普通用户跨账号共享企业画像、匹配记录或报告。
- 第一版不承诺通过企业名称自动获取全部画像字段，财务、纳税、研发、社保、项目类字段仍以用户确认为准。
- 第一版不把 DeepSeek 当作企业事实数据源，不让大模型凭空生成企业经营数据。
- 第一版不让 DeepSeek 单独决定最终政策匹配结果，必须保留规则引擎基线和可追溯证据。

## 3. 用户与权限

### 3.1 用户类型

第一版只区分普通用户和系统维护者。

- 普通用户：注册登录、维护自己的企业画像、发起匹配、查看自己的匹配记录和报告。
- 系统维护者：第一版通过代码、种子数据和采集脚本维护政策、规则和权重，不提供独立后台页面。

### 3.2 权限原则

- 所有企业画像必须绑定 `user_id`。
- 所有匹配任务必须绑定 `user_id`。
- 所有报告必须绑定 `user_id`。
- API 查询详情时必须同时校验资源 ID 和当前登录用户。
- 用户 A 不能通过猜测 ID 查看用户 B 的企业画像、匹配记录或报告。
- 政策列表和政策详情属于公共数据，可以登录后查看；是否允许未登录查看政策列表可在实现时保守设为需要登录。

## 4. 核心使用流程

1. 用户注册账号。
2. 用户登录。
3. 用户选择手动填写企业画像，或输入企业名称自动生成画像草稿。
4. 如果使用自动补全，系统返回候选企业，用户选择后生成画像草稿。
5. DeepSeek 对合法数据源返回内容做字段解耦，生成结构化画像草稿。
6. 用户确认自动补全字段并补齐缺失字段。
7. 系统保存企业画像。
8. 用户发起政策匹配。
9. 系统从政策库读取候选政策和规则。
10. 系统按字段权重计算基线匹配分数。
11. DeepSeek 基于企业画像、政策规则、政策原文片段和基线结果进行匹配复核与解释增强。
12. 系统保存匹配任务、规则结果、AI 复核结果和最终展示结果。
13. 系统调用 DeepSeek API，基于匹配结果生成文字版综合评估报告。
14. 用户查看匹配结果、政策解释和综合评估报告。

## 5. 产品目标

第一版目标不是替代政府申报系统，而是提供政策匹配解释和申报前判断。

核心目标：

- 帮用户快速知道“哪些龙华区政策可能适合我”。
- 帮用户理解“为什么匹配/为什么不匹配”。
- 帮用户知道“还缺哪些条件或材料方向”。
- 通过文字报告给出更容易阅读的综合建议。
- 保证不同用户的数据隔离，避免越权访问。
- 为后续真实政策采集、部署和管理后台打好数据模型与接口基础。

## 6. 企业画像字段

字段分为必填字段和选填字段。必填字段用于第一版匹配基础判断；选填字段用于提高匹配准确率和解释质量。

前端表单原则：

- 能做单选的字段用单选，不做自由文本。
- 能做复选/多选的字段用复选或多选，不做自由文本。
- 只有开放描述类、项目名称类、经营说明类字段使用文本输入。
- 选填字段也要纳入类型定义、数据库字段或扩展字段，不因为选填而丢失。
- 自动补全得到的字段必须让用户确认，不直接静默提交。

### 6.1 必填字段

| 模块 | 字段名 | TypeScript 类型 | 作用 |
| --- | --- | --- | --- |
| 基础信息 | `company_name` | `string` | 文本输入/自动补全；企业名称，报告展示用 |
| 基础信息 | `credit_code` | `string` | 文本输入/自动补全；统一社会信用代码，企业唯一标识 |
| 基础信息 | `city` | `'深圳市'` | 固定值；固定深圳市 |
| 基础信息 | `district` | `'龙华区'` | 固定值；固定龙华区 |
| 基础信息 | `registered_year` | `number` | 数字输入/自动补全；判断企业成立年限 |
| 基础信息 | `listed_status` | `ListedStatus` | 单选；判断是否上市，影响中小企业类政策 |
| 基础信息 | `employee_count` | `number` | 数字输入；判断企业规模 |
| 业务信息 | `industry` | `string` | 单选/自动推断后确认；判断是否属于政策扶持行业 |
| 业务信息 | `main_business` | `string` | 多行文本；描述主营业务，用于解释匹配原因 |
| 业务信息 | `main_products` | `string[]` | 标签多选/可新增；判断产品方向是否符合政策 |
| 业务信息 | `customer_type` | `CustomerType[]` | 复选；如政府客户、企业客户、个人客户 |
| 业务信息 | `business_model` | `BusinessModel` | 单选；判断业务模式，如 B2B、B2G、SaaS |
| 盈利信息 | `main_revenue_source` | `string` | 文本输入；判断收入来源是否清晰 |
| 盈利信息 | `revenue_last_year` | `number` | 数字输入；判断营收门槛 |
| 盈利信息 | `profit_last_year` | `number` | 数字输入；判断经营状况 |
| 盈利信息 | `tax_paid_last_year` | `number` | 数字输入；判断纳税贡献 |
| 研发创新 | `rd_expense_last_year` | `number` | 数字输入；判断研发投入金额 |
| 研发创新 | `rd_expense_ratio` | `number` | 数字输入；判断研发投入占比，单位为百分比 |
| 研发创新 | `rd_employee_count` | `number` | 数字输入；判断研发人员规模 |
| 研发创新 | `is_high_tech_enterprise` | `boolean` | 单选布尔/可自动校验；判断是否高新技术企业 |
| 研发创新 | `is_tech_sme` | `boolean` | 单选布尔/可自动校验；判断是否科技型中小企业 |
| 研发创新 | `has_specialized_new_sme` | `boolean` | 单选布尔/可自动校验；判断是否专精特新 |
| 研发创新 | `patent_count` | `number` | 数字输入/后续自动校验；判断知识产权能力 |
| 研发创新 | `software_copyright_count` | `number` | 数字输入/后续自动校验；软件企业/数字经济类政策常用 |
| 合规信息 | `tax_credit_level` | `TaxCreditLevel` | 单选；税务信用等级 |
| 合规信息 | `has_major_violation` | `boolean` | 单选布尔/可自动校验；有重大违法一般直接不推荐 |
| 合规信息 | `social_security_normal` | `boolean` | 单选布尔；判断社保缴纳是否正常 |
| 申报项目 | `apply_project_name` | `string` | 文本输入；本次申报项目名称 |
| 申报项目 | `project_direction` | `string` | 单选/可新增；项目方向，如 AI、数据治理、智能制造 |
| 申报项目 | `project_stage` | `ProjectStage` | 单选；研发中、已落地、规模化推广 |
| 申报项目 | `project_budget` | `number` | 数字输入；判断项目投入规模 |

### 6.2 建议选填字段

下面字段不作为第一版强制填写，但建议保留在类型定义和数据库扩展字段中。

| 模块 | 字段名 | TypeScript 类型 | 作用 |
| --- | --- | --- | --- |
| 基础信息 | `registered_capital` | `number` | 数字输入/自动补全；判断企业资本规模 |
| 基础信息 | `business_address` | `string` | 文本输入/自动补全；记录实际经营地址 |
| 基础信息 | `is_headquarters` | `boolean` | 单选布尔；总部经济类政策可能使用 |
| 基础信息 | `is_above_scale_enterprise` | `boolean` | 单选布尔；规上企业政策常用 |
| 业务信息 | `export_amount_last_year` | `number` | 数字输入；外贸类政策可能使用 |
| 业务信息 | `digital_transformation_status` | `string` | 单选；数字化改造类政策使用 |
| 业务信息 | `has_government_procurement_experience` | `boolean` | 单选布尔；政府客户和 B2G 项目解释使用 |
| 盈利信息 | `revenue_growth_rate` | `number` | 数字输入；判断增长型企业 |
| 盈利信息 | `asset_total` | `number` | 数字输入；企业规模判断 |
| 研发创新 | `has_rd_center` | `boolean` | 单选布尔；创新平台类政策可能使用 |
| 研发创新 | `standard_participation_count` | `number` | 数字输入；标准制定类奖励可能使用 |
| 研发创新 | `award_titles` | `string[]` | 多选/可新增；荣誉资质类匹配 |
| 合规信息 | `credit_blacklist` | `boolean` | 单选布尔/可自动校验；严重失信直接降级 |
| 合规信息 | `environment_penalty_count` | `number` | 数字输入/可自动校验；环保处罚风险提示 |
| 申报项目 | `project_start_date` | `string` | 日期选择；判断项目周期，ISO 日期字符串 |
| 申报项目 | `project_end_date` | `string` | 日期选择；判断项目周期，ISO 日期字符串 |
| 申报项目 | `project_invested_amount` | `number` | 数字输入；判断已投入金额 |
| 申报项目 | `expected_subsidy_amount` | `number` | 数字输入；申报预期展示 |

### 6.3 字段处理原则

- 必填字段如果为空，前端不允许提交，后端也必须拒绝。
- 数字字段必须校验为非负数。
- 比例字段需约束合理范围，`rd_expense_ratio` 用 `12.5` 表示 12.5%。
- 布尔字段必须明确为 `true` 或 `false`。
- 多选字段统一用数组。
- 第一版使用中文展示名，但 API JSON 字段名使用 snake_case。
- 关键枚举字段必须使用 TypeScript union 或 enum，并用 Zod 做运行时校验。
- 金额字段单位统一为“元”。
- 年份字段如 `registered_year` 使用四位年份，例如 `2021`。
- 自动补全字段需要标记来源，例如 `manual`、`official_open_data`、`commercial_api`、`inferred`。
- 自动推断字段需要展示“请确认”，不能当作已验证事实。

### 6.4 表单控件类型

| 字段类型 | 控件 | 示例字段 |
| --- | --- | --- |
| 固定值 | 只读文本/隐藏字段 | `city`、`district` |
| 枚举单选 | 单选按钮/Select | `listed_status`、`business_model`、`tax_credit_level`、`project_stage` |
| 布尔值 | 是/否单选或开关 | `is_high_tech_enterprise`、`has_major_violation` |
| 多选枚举 | CheckboxGroup/MultiSelect | `customer_type`、`award_titles` |
| 标签数组 | TagInput/MultiSelect | `main_products` |
| 数字 | NumberInput | `employee_count`、`revenue_last_year`、`project_budget` |
| 百分比 | NumberInput + `%` 后缀 | `rd_expense_ratio`、`revenue_growth_rate` |
| 日期 | DatePicker | `project_start_date`、`project_end_date` |
| 短文本 | Input | `company_name`、`credit_code`、`apply_project_name` |
| 长文本 | Textarea | `main_business`、`main_revenue_source` |

## 7. 字段枚举

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

export type ReportStatus =
  | 'pending'
  | 'generating'
  | 'completed'
  | 'failed';
```

## 8. 权重分配

第一版采用模块总权重 100 分。权重先通过代码配置维护，后续如果效果不理想再人工调整代码。

| 模块 | 权重 | 说明 |
| --- | ---: | --- |
| 基础信息 | 20 | 判断地域、成立年限、规模、企业身份 |
| 业务信息 | 20 | 判断行业、主营业务、产品方向、客户类型 |
| 盈利信息 | 15 | 判断营收、利润、纳税贡献 |
| 研发创新 | 25 | 龙华区产业和科创类政策通常高度相关 |
| 合规信息 | 10 | 违法、信用、社保等作为风险和硬性条件 |
| 申报项目 | 10 | 判断本次项目方向、阶段和投入规模 |

### 8.1 基础信息权重

| 字段 | 权重 | 说明 |
| --- | ---: | --- |
| `city` | 4 | 固定深圳市，作为深圳范围政策前置条件 |
| `district` | 6 | 固定龙华区，区级政策核心条件 |
| `registered_year` | 3 | 判断成立年限 |
| `listed_status` | 2 | 判断上市/中小企业相关政策 |
| `employee_count` | 5 | 判断企业规模 |

`company_name` 和 `credit_code` 用于展示、唯一标识和历史记录归档，不直接计分。

### 8.2 业务信息权重

| 字段 | 权重 | 说明 |
| --- | ---: | --- |
| `industry` | 7 | 是否属于政策扶持行业 |
| `main_business` | 4 | 用于解释业务匹配原因 |
| `main_products` | 4 | 判断产品方向 |
| `customer_type` | 2 | 判断 B2G、企业服务等方向 |
| `business_model` | 3 | 判断 SaaS、制造、平台等模式 |

### 8.3 盈利信息权重

| 字段 | 权重 | 说明 |
| --- | ---: | --- |
| `main_revenue_source` | 2 | 收入来源是否清晰 |
| `revenue_last_year` | 5 | 是否达到营收门槛 |
| `profit_last_year` | 3 | 经营状况 |
| `tax_paid_last_year` | 5 | 纳税贡献 |

### 8.4 研发创新权重

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

### 8.5 合规信息权重

| 字段 | 权重 | 说明 |
| --- | ---: | --- |
| `tax_credit_level` | 3 | 税务信用 |
| `has_major_violation` | 4 | 重大违法，一般直接不推荐 |
| `social_security_normal` | 3 | 社保正常缴纳 |

### 8.6 申报项目权重

| 字段 | 权重 | 说明 |
| --- | ---: | --- |
| `apply_project_name` | 1 | 展示和报告摘要 |
| `project_direction` | 4 | 项目方向是否符合政策 |
| `project_stage` | 2 | 判断成熟度 |
| `project_budget` | 3 | 判断投入规模 |

## 9. 匹配等级

| 等级 | 分数/条件 | 展示含义 |
| --- | --- | --- |
| `recommended` | 80 分及以上，且无硬性条件失败 | 推荐关注 |
| `potential` | 60-79 分，或存在少量信息缺口 | 可能匹配 |
| `need_more_info` | 关键字段缺失，无法判断 | 需补充信息 |
| `not_recommended` | 低于 60 分，或硬性条件失败 | 暂不推荐 |

硬性条件失败优先级高于分数。

## 10. 硬性条件

以下条件如果不满足，相关政策应直接降级为 `not_recommended` 或 `need_more_info`：

- 政策限定龙华区，但企业 `district` 不是龙华区。
- 政策限定深圳市，但企业 `city` 不是深圳市。
- 政策已过期或申报窗口已关闭。
- 政策要求无重大违法，但 `has_major_violation = true`。
- 政策要求特定行业，但企业行业明显不符。
- 政策要求特定资质，例如高新技术企业、专精特新、科技型中小企业，但企业未具备。

如果字段为空，优先标记 `need_more_info`，不要误判为不匹配。

## 11. 龙华区政策文件库采集

第一版直接做龙华区政策文件库采集。

目标来源：

- 龙华政府在线政策文件库：https://www.szlhq.gov.cn/xxgk/zcfg/qgfxwj/qzcxwj/index.html

采集目标：

- 政策标题
- 政策正文
- 原文链接
- 发布机构
- 发布时间
- 有效性
- 所属行业
- 企业特色分类
- 资金字段
- 申报公告链接
- 政策解读链接
- 咨询电话

实现原则：

- 先抓取并保存原始页面和原始字段到 `source_documents`。
- 再解析为标准化 `policies`。
- 政策规则第一版先由代码/种子数据维护，不完全依赖自动抽取。
- 采集器失败不能影响用户登录和历史结果查看。
- 每次采集要保存 `content_hash`，避免重复入库。

## 12. 企业画像自动补全

第一版保留手动填写，同时新增“输入企业名称自动补全画像草稿”的路径。

### 12.1 可行性判断

企业公开信息不是完整企业画像。公开渠道可以辅助补全工商和信用基础信息，但不能可靠获取所有经营、财务、研发和项目申报字段。

可较可靠自动补全：

- `company_name`
- `credit_code`
- `registered_year`
- `registered_capital`
- `business_address`
- `industry` 初步推断
- `main_business` 草稿
- 部分资质荣誉
- 部分知识产权数量
- 部分处罚或信用风险信息

通常仍需用户填写或确认：

- `employee_count`
- `main_products`
- `customer_type`
- `business_model`
- `main_revenue_source`
- `revenue_last_year`
- `profit_last_year`
- `tax_paid_last_year`
- `rd_expense_last_year`
- `rd_expense_ratio`
- `rd_employee_count`
- `social_security_normal`
- `apply_project_name`
- `project_direction`
- `project_stage`
- `project_budget`

### 12.2 自动补全流程

1. 用户输入企业名称。
2. 后端调用合法数据源查询企业候选列表。
3. 前端展示候选企业名称、统一社会信用代码、登记地址等摘要信息。
4. 用户选择一个候选企业。
5. 系统生成企业画像草稿。
6. 自动补全字段展示数据来源和置信度。
7. 用户确认、修改并补齐缺失字段。
8. 用户保存画像。
9. 匹配引擎只使用用户保存后的画像。

### 12.3 DeepSeek 在自动补全中的定位

DeepSeek API 可以参与“字段解耦”，但不能直接作为企业事实数据源。系统必须先通过后端接入的合法数据源拿到原始企业信息，再把这些原始信息交给 DeepSeek 按企业画像 schema 解析。

推荐定位：

- 后端负责查询事实数据，例如企业候选、统一社会信用代码、登记地址、经营范围、资质名单、处罚信息。
- DeepSeek 负责把 `raw_payload` 解耦成结构化 `mapped_profile`，并给出字段来源、缺失字段和置信度。
- Zod 负责校验 DeepSeek 输出是否符合企业画像 DTO 和枚举约束。
- 前端负责展示“自动补全草稿”，用户确认后才能保存。
- 匹配引擎只读取用户确认并保存后的企业画像，不直接读取未确认的 AI 草稿。

DeepSeek 不能做的事：

- 不能凭企业名称直接生成营收、利润、纳税额、研发费用、社保等内部经营数据。
- 不能把没有来源的数据标记成事实。
- 不能绕过数据源授权、验证码、登录和反爬限制。

允许 DeepSeek 做低风险推断：

- 从经营范围推断行业草稿。
- 从公开介绍生成主营业务草稿。
- 从登记地址辅助判断是否位于龙华区。
- 从资质名单文本中提取是否属于高企、科技型中小企业、专精特新等标签。

所有推断字段必须标记为 `inferred`，并要求用户确认。

### 12.4 数据源策略

第一优先级：

- 深圳市政府数据开放平台“统一社会信用代码信息”等官方开放接口。

第二优先级：

- 深圳信用网、市场监管公开信息、高新技术企业查询、科技型中小企业查询、专精特新公开名单、国家知识产权局公开检索等官方公开来源。

第三优先级：

- 合法商业 API，例如企查查/QCC。是否采购和接入取决于后续预算和授权。

不允许：

- 绕过验证码。
- 绕过登录限制。
- 绕过反爬限制。
- 将未经确认的网页猜测数据当作事实入库。

### 12.5 自动补全字段来源标记

每个自动补全字段都需要标记：

- `source_name`
- `source_url`
- `source_type`
- `confidence`
- `fetched_at`
- `is_user_confirmed`

字段来源类型：

```ts
export type ProfileFieldSourceType =
  | 'manual'
  | 'official_open_data'
  | 'official_public_page'
  | 'commercial_api'
  | 'local_seed'
  | 'inferred';
```

## 13. DeepSeek 画像解耦、匹配增强与文字报告

第一版需要 DeepSeek 赋能，但边界必须清楚：DeepSeek 是智能处理层，不是企业事实数据源，也不是最终规则裁判。系统用规则引擎保留可追溯基线，用 DeepSeek 提升字段解耦、语义复核、解释质量和报告可读性。

### 13.1 企业画像字段解耦

输入：

- 合法数据源返回的 `raw_payload`。
- 数据源名称、来源链接、抓取时间。
- 目标企业画像 schema、字段枚举和字段来源类型。
- 明确禁止编造的字段清单，例如营收、利润、纳税额、研发费用、社保等。

输出：

- `mapped_profile`：结构化企业画像草稿。
- `field_sources`：每个字段的来源、来源类型和置信度。
- `missing_fields`：无法从公开数据获取且需要用户补充的字段。
- `ai_confidence`：画像草稿整体置信度。
- `needs_user_confirmation`：必须为 `true`。

约束：

- 使用 JSON 输出，并在后端用 Zod 校验。
- 字段值只能来自 `raw_payload`、明确数据源，或标记为 `inferred` 的低风险推断。
- 对财务、纳税、研发、社保、项目预算等内部字段，如果数据源没有提供，必须输出 `null` 或进入 `missing_fields`，不能猜测。
- DeepSeek 输出不通过 schema 校验时，本次画像解耦失败，用户仍可手动填写。

### 13.2 匹配复核与解释增强

匹配功能必须通过 DeepSeek 赋能，但不能让 DeepSeek 单独决定最终结果。第一版采用“两段式匹配”：

1. 规则引擎先根据政策规则、硬性条件和字段权重生成 `baseline_score`、`baseline_level`、命中条件、缺失条件和风险提示。
2. DeepSeek 再读取企业画像、政策原文片段、政策规则、规则引擎结果，输出 AI 复核意见、解释增强和补充建议。

DeepSeek 匹配复核输入：

- 已保存且用户确认的企业画像。
- 候选政策的标题、来源链接、原文片段。
- 政策结构化规则和权重。
- 规则引擎输出的基线结果。

DeepSeek 匹配复核输出：

- `ai_review_summary`：对当前政策匹配程度的简要复核。
- `ai_explanation`：更自然的命中/不命中解释。
- `ai_missing_fields`：建议用户补充的字段。
- `ai_suggested_actions`：申报前建议动作。
- `ai_confidence`：AI 复核置信度。
- `ai_adjustment`：可选的微调建议，范围限制为 `-5` 到 `5` 分。

最终结果规则：

- 硬性条件失败时，DeepSeek 不能把政策改成推荐。
- DeepSeek 只能基于已有企业字段和政策原文证据解释或建议，不能新增政策条件和企业事实。
- `final_score` 可以在无硬性失败、AI 输出通过校验、且引用证据明确时采用小幅 `ai_adjustment`。
- 页面必须同时展示规则基线、AI 复核说明和最终展示等级，方便追溯。

### 13.3 文字报告

报告形式为网页内文字报告，不做 Word/PDF 导出。

报告输入：

- 企业画像摘要。
- 规则匹配结果。
- DeepSeek 匹配复核结果。
- 推荐政策列表、可能匹配政策列表、需补充信息政策列表、暂不推荐政策摘要。
- 命中条件、缺失条件、风险提示、建议动作。

报告输出：

- 总体结论。
- 企业优势。
- 推荐关注政策。
- 主要短板和补充材料方向。
- 风险提示。
- 下一步建议。

### 13.4 接入方式

根据 DeepSeek 官方文档，第一版使用 OpenAI 兼容格式：

- `base_url`: `https://api.deepseek.com`
- API: `POST /chat/completions`
- 推荐模型：`deepseek-v4-flash`
- 高质量报告可配置为：`deepseek-v4-pro`
- API Key 通过环境变量 `DEEPSEEK_API_KEY` 注入
- 结构化输出使用 `response_format: { "type": "json_object" }`
- 如采用工具调用，只允许后端定义的函数，例如 `search_company_by_name`、`fetch_company_credit_profile`、`fetch_policy_candidates`

工具调用要求：

- DeepSeek 只能生成函数调用参数，实际查询必须由后端服务执行。
- 工具调用参数必须经过 Zod 校验后才能执行。
- 工具返回的数据必须保存来源和时间，不能直接作为已确认画像。

官方文档显示旧模型名 `deepseek-chat` 和 `deepseek-reasoner` 将在 2026-07-24 15:59 UTC 弃用，因此第一版不使用旧模型名。

### 13.5 安全和可靠性

- 不在前端暴露 DeepSeek API Key。
- API Key 只保存在后端环境变量中。
- 后端调用 DeepSeek API。
- DeepSeek `user_id` 参数只能使用系统内部匿名 ID 或哈希 ID，不放邮箱、企业名称、统一社会信用代码等隐私信息。
- 保存画像解耦、匹配复核、报告生成状态：`pending`、`generating`、`completed`、`failed`。
- DeepSeek 调用失败时，用户仍可查看手动画像和规则引擎结构化匹配结果。
- 报告内容保存到数据库，避免每次打开都重新调用大模型。
- prompt 必须集中管理，并要求“不得编造政策，不得编造企业经营数据，不得编造申报入口，不得覆盖硬性条件失败，不得改变无证据的结构化匹配结论”。
- DeepSeek 返回 JSON 不合法、超时、被内容过滤或字段校验失败时，系统返回可读错误并记录失败原因。

## 14. 核心页面

### 14.1 注册/登录页

功能：

- 用户注册。
- 用户登录。
- 用户退出。

第一版账号字段：

- `email`
- `password`
- `display_name`

安全要求：

- 密码必须哈希存储。
- 不保存明文密码。
- 登录态使用后端签发的 token 或安全 session，具体实现编码前确定。

### 14.2 企业画像录入页

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
- 可单选、复选、多选的字段必须使用选择控件。
- 不能枚举化的字段再使用文本输入。
- 支持从企业名称自动补全画像草稿。
- 自动补全字段必须显示来源并允许用户确认或修改。
- 类型错误实时提示。
- 提交前做完整校验。
- 保存后只能当前用户查看。

### 14.3 企业名称自动补全页/弹窗

展示：

- 企业名称搜索框。
- 候选企业列表。
- 候选企业的统一社会信用代码、登记地址、经营状态。
- DeepSeek 画像字段解耦状态。
- 生成画像草稿按钮。
- 自动补全字段确认界面。

### 14.4 企业画像历史页

展示：

- 当前用户保存过的企业画像。
- 画像创建时间和更新时间。
- 进入详情。
- 基于某个画像发起匹配。

### 14.5 匹配结果页

展示：

- 总体匹配概览。
- 规则引擎基线分数和等级。
- DeepSeek 匹配复核摘要。
- 推荐关注政策。
- 可能匹配政策。
- 需补充信息政策。
- 暂不推荐政策。
- 每条政策展示最终分数、等级、核心命中原因、主要缺失条件。

### 14.6 政策详情/解释页

展示：

- 政策标题。
- 政策来源链接。
- 规则基线分数、AI 微调建议和最终展示分数。
- 命中条件。
- 缺失条件。
- 风险提示。
- 建议动作。

### 14.7 文字报告页

展示：

- 报告生成状态。
- DeepSeek 生成的综合评估报告。
- 结构化匹配结果摘要。
- 报告生成失败时展示可读错误和结构化结果。

## 15. API 初稿

### 15.1 健康检查

- `GET /health`

### 15.2 认证

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

### 15.3 企业画像

- `POST /api/enterprise-profiles`
- `GET /api/enterprise-profiles`
- `GET /api/enterprise-profiles/:id`
- `PUT /api/enterprise-profiles/:id`
- `DELETE /api/enterprise-profiles/:id`

权限要求：

- 所有接口都必须校验当前用户。
- 查询、修改、删除时必须确认资源属于当前用户。

### 15.4 企业画像自动补全

- `POST /api/company-lookup/search`
- `POST /api/company-lookup/:id/generate-profile`

权限要求：

- 查询记录必须绑定当前用户。
- 生成画像草稿时必须确认 lookup 记录属于当前用户。
- 画像草稿不直接写入正式企业画像表，必须经过用户确认并调用 `POST /api/enterprise-profiles` 保存。

### 15.5 政策

- `GET /api/policies`
- `GET /api/policies/:id`

### 15.6 匹配

- `POST /api/match-runs`
- `GET /api/match-runs`
- `GET /api/match-runs/:id`
- `POST /api/match-runs/:id/ai-review`

权限要求：

- 匹配任务必须属于当前用户。
- 获取匹配详情时不能越权。
- AI 复核只能基于当前用户自己的匹配任务生成或重试。

### 15.7 文字报告

- `POST /api/match-runs/:id/report`
- `GET /api/match-runs/:id/report`

权限要求：

- 只能为自己的匹配任务生成和查看报告。

### 15.8 政策采集

第一版采集接口不暴露给普通用户。采集任务通过脚本或后端内部命令运行。

## 16. TypeScript 和接口规范

### 16.1 命名规范

- 数据库字段使用 snake_case。
- API JSON 字段使用 snake_case。
- TypeScript 类型和接口使用 PascalCase。
- 枚举值使用小写 snake_case 或明确英文常量，不混用中文。

### 16.2 类型和校验规范

- 请求体、响应体、枚举、错误结构必须统一定义在共享包中。
- 后端必须使用 Zod 做运行时校验。
- 前端表单必须复用共享 schema 或共享类型。
- Express controller 不直接写业务逻辑，只负责解析请求、调用 service、返回响应。
- 所有金额字段单位统一为“元”。
- 所有比例字段统一使用百分比数字。

### 16.3 错误响应

统一错误响应格式：

```ts
export interface ApiErrorResponse {
  error_code: string;
  message: string;
  details?: unknown;
}
```

常见错误码：

- `VALIDATION_ERROR`
- `UNAUTHORIZED`
- `FORBIDDEN`
- `NOT_FOUND`
- `RESOURCE_NOT_OWNED`
- `DEEPSEEK_PROFILE_EXTRACT_FAILED`
- `DEEPSEEK_MATCH_REVIEW_FAILED`
- `DEEPSEEK_REPORT_FAILED`
- `POLICY_SYNC_FAILED`
- `COMPANY_LOOKUP_FAILED`
- `COMPANY_LOOKUP_NOT_CONFIRMED`

## 17. 数据库核心表

第一版核心表：

- `users`
- `enterprise_profiles`
- `company_lookup_records`
- `policies`
- `policy_rules`
- `policy_applications`
- `source_documents`
- `match_runs`
- `match_results`
- `reports`

### 17.1 用户数据隔离

必须包含 `user_id` 的表：

- `enterprise_profiles`
- `company_lookup_records`
- `match_runs`
- `match_results`
- `reports`

查询这些表时必须带上当前用户的 `user_id` 条件。

### 17.2 企业自动补全记录表

`company_lookup_records` 保存企业名称查询和自动补全草稿。

核心字段：

- `id`
- `user_id`
- `query_name`
- `selected_company_name`
- `selected_credit_code`
- `source_name`
- `source_type`
- `raw_payload`
- `mapped_profile`
- `field_sources`
- `missing_fields`
- `ai_extracted_profile`
- `ai_confidence`
- `ai_model_name`
- `ai_prompt_snapshot`
- `ai_error_message`
- `confidence`
- `is_imported`
- `created_at`

### 17.3 匹配任务和匹配结果表

`match_runs` 保存一次匹配任务，`match_results` 保存每条政策的规则基线、AI 复核和最终展示结果。

`match_runs` 核心字段：

- `id`
- `user_id`
- `enterprise_profile_id`
- `profile_snapshot`
- `baseline_status`
- `ai_review_status`
- `ai_model_name`
- `ai_prompt_snapshot`
- `ai_error_message`
- `created_at`
- `updated_at`

`match_results` 核心字段：

- `id`
- `user_id`
- `match_run_id`
- `policy_id`
- `baseline_score`
- `baseline_level`
- `matched_conditions`
- `missing_conditions`
- `risk_notes`
- `ai_review_summary`
- `ai_explanation`
- `ai_missing_fields`
- `ai_suggested_actions`
- `ai_confidence`
- `ai_adjustment`
- `final_score`
- `final_level`
- `created_at`

### 17.4 报告表

`reports` 保存文字报告，不保存 Word/PDF。

核心字段：

- `id`
- `user_id`
- `match_run_id`
- `status`
- `content_text`
- `model_name`
- `prompt_snapshot`
- `error_message`
- `created_at`
- `updated_at`

## 18. 非功能需求

### 18.1 安全

- 密码哈希存储。
- API 鉴权中间件保护用户数据接口。
- 所有用户资源接口必须做 ownership 校验。
- DeepSeek API Key 只保存在后端环境变量。
- 日志不能输出密码、token、API Key。
- 不绕过第三方网站验证码、登录和反爬限制。
- 企业公开信息自动补全必须展示来源，用户确认后才能进入匹配。

### 18.2 可维护性

- 匹配逻辑必须独立于 Express 路由。
- 权重配置必须集中管理，不能散落在页面或 controller 中。
- 字段定义必须集中管理，便于后续调整。
- DeepSeek prompt 模板集中管理，便于调整报告风格。
- 企业画像字段配置要集中管理，包含字段类型、控件类型、是否必填、可选项和权重。

### 18.3 可测试性

必须为匹配逻辑和权限逻辑写测试：

- 地区不符。
- 重大违法。
- 高企资质命中。
- 专精特新命中。
- 研发投入比例命中。
- 字段缺失进入 `need_more_info`。
- 分数边界进入正确等级。
- 用户 A 不能查看用户 B 的企业画像。
- 用户 A 不能查看用户 B 的匹配结果。
- 用户 A 不能导入用户 B 的企业查询记录。
- DeepSeek 调用失败时结构化结果仍可查看。
- DeepSeek 画像解耦失败时仍可手动填写。
- DeepSeek 返回非法 JSON 时不能写入已确认画像或最终匹配结果。
- DeepSeek 不能给营收、纳税、研发、社保等缺失字段编造数值。
- DeepSeek 不能覆盖硬性条件失败，例如地区不符、重大违法、政策过期。

### 18.4 可部署性

- 使用 `.env` 管理数据库连接和 DeepSeek API Key。
- 支持本地开发和腾讯云轻量服务器部署。
- 后续使用 Docker Compose 部署 PostgreSQL、API 和前端。
- PostgreSQL 数据需要持久化卷。
- 需要数据库备份脚本。

## 19. 里程碑

### M1：项目骨架

- 前端 Vue 3 + TypeScript。
- 后端 Express + TypeScript。
- 共享类型包。
- PostgreSQL 连接。
- Zod 校验基础设施。
- 健康检查接口。

### M2：认证和用户隔离

- 注册接口。
- 登录接口。
- 当前用户接口。
- 鉴权中间件。
- 用户资源 ownership 校验。

### M3：企业画像

- 企业画像表单。
- 字段控件配置。
- 字段校验。
- API 类型定义。
- 保存企业画像。
- 企业画像历史列表。
- 企业名称自动补全草稿确认流程。

### M4：企业公开信息自动补全

- 企业名称查询接口。
- 候选企业列表。
- DeepSeek 画像字段解耦。
- 画像草稿生成。
- 自动补全字段来源标记。
- 用户确认后导入企业画像。

### M5：政策采集和政策库

- 龙华区政策文件库采集脚本。
- `source_documents` 原始数据保存。
- `policies` 标准化数据保存。
- 种子规则数据。
- 政策列表和详情。

### M6：匹配引擎

- 权重配置。
- 规则计算。
- DeepSeek 匹配复核。
- AI 复核和规则基线结果合并。
- 匹配等级。
- 结果保存。
- 单元测试。

### M7：DeepSeek 文字报告

- 报告 prompt 模板。
- DeepSeek API 后端服务封装。
- 报告生成接口。
- 报告保存。
- 报告页面。

### M8：部署准备

- Docker Compose。
- 环境变量模板。
- 服务器部署文档。
- 数据库备份说明。

## 20. 编码前仍需提供的信息

下面不是产品方向问题，而是实施配置问题。可以在编码或部署前补充：

1. 腾讯云轻量服务器配置：CPU、内存、磁盘、操作系统。
2. DeepSeek API Key：只在本地 `.env` 或服务器环境变量中配置，不要写进仓库。
3. 是否希望登录态采用 JWT 还是服务端 session。如果你不指定，编码前我会给出两种方案并说明取舍。

## 21. 参考资料

- DeepSeek API Quick Start: https://api-docs.deepseek.com/
- DeepSeek Chat Completion API: https://api-docs.deepseek.com/api/create-chat-completion
- DeepSeek Function Calling Guide: https://api-docs.deepseek.com/guides/function_calling
- DeepSeek Models & Pricing: https://api-docs.deepseek.com/quick_start/pricing
- DeepSeek V4 Preview Release: https://api-docs.deepseek.com/news/news260424
- 企业画像自动补全调研：docs/research/enterprise-profile-data-sources.md
