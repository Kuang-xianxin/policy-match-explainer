# 企业画像自动补全数据源可行性调研

调研日期：2026-07-03

## 结论

“输入企业名称自动生成企业画像”可以作为第一版增强能力，但不能替代手动填写。更准确的产品定位是：企业名称检索后自动补全部分公开字段，再由用户确认和补齐申报所需字段。

可自动补全的字段主要包括：

- 企业名称
- 统一社会信用代码
- 注册地址或登记地址
- 注册资本
- 成立日期/成立年份
- 经营状态
- 经营范围
- 行业粗分类
- 部分知识产权数量
- 部分资质荣誉名单
- 部分行政处罚或信用风险信息

通常不能可靠自动获取的字段：

- 上年度营收
- 上年度利润
- 上年度纳税额
- 研发费用
- 研发费用占比
- 研发人员数量
- 社保是否正常
- 真实客户类型
- 主营收入来源
- 本次申报项目预算和项目阶段

这些字段对政策匹配很关键，但多数属于企业内部经营数据或申报材料数据。即使互联网上有部分估算，也不适合作为政策匹配的事实依据。

## DeepSeek 在自动补全中的可行性

结论：可行，但不能理解为“用户输入企业名称后，DeepSeek 自己上网获取完整企业画像”。更可靠的工程方案是：

1. 后端用合法官方接口或商业 API 查询企业事实数据。
2. DeepSeek 读取这些数据源返回的 `raw_payload`。
3. DeepSeek 按企业画像 schema 做字段解耦、字段归一化和缺失字段识别。
4. 后端用 Zod 校验 AI 输出。
5. 前端展示画像草稿、字段来源和置信度。
6. 用户确认后，画像才能进入匹配引擎。

适合 DeepSeek 处理的任务：

- 从经营范围、登记行业、公开介绍中提取 `industry`、`main_business` 草稿。
- 把资质名单、公告附件、信用信息中的文本转成结构化布尔字段或风险字段。
- 将不同数据源里的字段名统一到项目的 snake_case DTO。
- 识别哪些字段缺失，并提示用户补充。
- 对规则匹配结果做语义复核和解释增强。

不适合 DeepSeek 直接处理的任务：

- 凭企业名称生成营收、利润、纳税额、研发费用、研发人员数量、社保状态。
- 凭模型记忆判断企业当前真实状态。
- 绕过验证码、登录、授权和反爬限制获取数据。
- 单独决定最终政策匹配结果。

匹配功能建议同样采用“两段式”：

- 第一段：规则引擎计算 `baseline_score`、硬性条件、命中条件和缺失条件。
- 第二段：DeepSeek 读取企业画像、政策规则、政策原文片段和规则基线结果，生成 `ai_review_summary`、`ai_explanation`、`ai_missing_fields`、`ai_suggested_actions` 和小幅 `ai_adjustment`。

硬性条件失败时，DeepSeek 只能解释原因或建议补充材料，不能把政策改成推荐。

## 官方和公开数据源

### 深圳市政府数据开放平台

发现的数据接口：

- 统一社会信用代码信息：https://opendata.sz.gov.cn/data/api/toApiDetails/29200_01300275

价值：

- 提供部门为深圳市市场监督管理局。
- 属于政府数据开放平台的数据接口。
- 可用于企业名称、统一社会信用代码等基础信息校验。

注意：

- 平台服务条款要求遵守法律法规，注明数据来源，不得歪曲篡改数据。
- 平台明确数据资源提供者对完整性、准确性、及时性不作绝对承诺。
- 实际接口调用方式、限流、是否需要应用注册，需要编码阶段再验证。

### 深圳信用网

入口：

- https://www.szcredit.org.cn/

价值：

- 可查询深圳企业公共信用信息。
- 适合补充信用报告、行政处罚、信用风险等信息。

注意：

- 报告型信息不一定适合自动批量抓取。
- 若需要完整报告，可能涉及登录、验证码、授权或使用限制。

### 国家企业信用信息公示系统 / 市场监管公示平台

相关入口：

- 深圳市市场监督管理局商事主体信用监管公示平台：https://amr.sz.gov.cn/xyjggs.webui/xyjggs/index.aspx
- 国家企业信用信息公示系统各地站点

价值：

- 企业登记、年报、抽查检查、行政处罚等官方信用信息来源。
- 适合人工校验和作为可信来源。

注意：

- 常见验证码、反自动化、登录限制。
- 不建议直接绕过限制抓取。
- 第一版应优先使用官方开放平台接口或用户授权方式。

### 高新技术企业认定管理工作网

入口：

- https://www.innocom.gov.cn/gqrdw/c101322/cxfw.shtml

价值：

- 可查询高新技术企业认定相关信息。
- 可用于辅助判断 `is_high_tech_enterprise`。

注意：

- 查询服务可能需要精确企业信息或验证码。
- 更适合做单企查询或人工校验，不适合作为无约束批量数据源。

### 科技型中小企业查询

入口：

- 科学技术部政务服务平台：https://fuwu.most.gov.cn/html/fwcx/kjxzxqy/
- 科技型中小企业服务：https://innofund.chinatorch.org.cn/zxqyfw/cxfw/cxfw.shtml

价值：

- 可用于辅助判断 `is_tech_sme`。

注意：

- 查询通常需要企业名称、入库登记机关、验证码等信息。
- 适合人工校验或低频查询。

### 专精特新名单

相关来源：

- 深圳市中小企业服务局公告，例如深圳市专精特新中小企业和复核公示名单。
- 龙华区、深圳市政府网站公开公告。

价值：

- 可用于辅助判断 `has_specialized_new_sme`。

注意：

- 通常以公告附件形式发布。
- 需要解析附件和名单，适合做周期性维护，不适合实时按名称查询。

### 国家知识产权局相关系统

入口：

- 国家知识产权局：https://www.cnipa.gov.cn/
- 专利检索及分析系统：https://pss-system.cponline.cnipa.gov.cn/
- 专利业务办理系统：https://cponline.cnipa.gov.cn/

价值：

- 可用于核验专利信息。

注意：

- 专利、商标、软件著作权数据分散。
- 官方页面不一定提供适合第一版直接调用的开放 API。
- 第一版可以先把 `patent_count`、`software_copyright_count` 作为用户填写字段，后续再做自动校验。

## 商业 API

### 企查查 / QCC

入口：

- https://mapi.qcc.com/dataApi
- https://www.qcckyc.com/

价值：

- 覆盖工商、股权、司法风险、知识产权、经营风险等数据。
- 有企业 API 和 KYC/KYB 场景。
- 如果预算允许，是“企业名称自动补全画像”的现实方案。

注意：

- 商业接口通常收费。
- 字段授权范围、调用额度、数据合规条款需要采购前确认。
- 第三方数据不能替代用户对申报材料真实性的确认。

## 字段自动补全可行性矩阵

| 字段 | 自动获取可行性 | 建议 |
| --- | --- | --- |
| `company_name` | 高 | 名称搜索返回后填充 |
| `credit_code` | 高 | 优先从官方开放数据或商业 API 获取 |
| `city` | 高 | 第一版固定深圳市 |
| `district` | 中 | 可根据登记地址/行政区解析，第一版固定龙华区 |
| `registered_year` | 高 | 由成立日期转换 |
| `listed_status` | 中 | 上市公司可查，非上市状态需用户确认 |
| `employee_count` | 低 | 非上市企业通常不公开，用户填写 |
| `industry` | 中 | 可由经营范围/登记行业推断，需用户确认 |
| `main_business` | 中 | 可由经营范围生成草稿，需用户确认 |
| `main_products` | 低 | 多数需用户填写 |
| `customer_type` | 低 | 通常需用户填写 |
| `business_model` | 低 | 通常需用户填写 |
| `main_revenue_source` | 低 | 企业内部信息，用户填写 |
| `revenue_last_year` | 低 | 非上市企业通常不公开，用户填写 |
| `profit_last_year` | 低 | 非上市企业通常不公开，用户填写 |
| `tax_paid_last_year` | 低 | 通常不公开，用户填写 |
| `rd_expense_last_year` | 低 | 通常不公开，用户填写 |
| `rd_expense_ratio` | 低 | 通常不公开，用户填写 |
| `rd_employee_count` | 低 | 通常不公开，用户填写 |
| `is_high_tech_enterprise` | 中 | 可查但可能需验证码/名单解析 |
| `is_tech_sme` | 中 | 可查但可能需验证码/名单解析 |
| `has_specialized_new_sme` | 中 | 可通过公告名单解析 |
| `patent_count` | 中 | 可查但实现成本较高，第一版可手填 |
| `software_copyright_count` | 中低 | 可查但实现成本较高，第一版可手填 |
| `tax_credit_level` | 中低 | 信用信息可能可查，自动化需谨慎 |
| `has_major_violation` | 中 | 可由信用/处罚数据辅助判断 |
| `social_security_normal` | 低 | 通常不公开，用户填写 |
| `apply_project_name` | 无 | 用户填写 |
| `project_direction` | 无 | 用户填写 |
| `project_stage` | 无 | 用户填写 |
| `project_budget` | 无 | 用户填写 |

## 产品建议

第一版建议同时保留两条路径：

1. 手动填写企业画像。
2. 输入企业名称自动补全基础信息，再进入表单确认和补全。

自动补全接口不应直接驱动最终匹配，而应生成“画像草稿”。用户确认后，草稿才进入匹配引擎。

推荐流程：

1. 用户输入企业名称。
2. 系统调用企业公开信息查询接口。
3. 系统返回候选企业列表。
4. 用户选择企业。
5. 系统生成企业画像草稿。
6. 用户确认并补充缺失字段。
7. 系统保存画像并发起匹配。

## 技术建议

新增后端能力：

- `POST /api/company-lookup/search`
- `POST /api/company-lookup/:lookup_id/ai-extract`
- `POST /api/company-lookup/:lookup_id/import`
- `POST /api/match-runs/:match_run_id/ai-review`

新增数据表：

- `company_lookup_records`

核心字段：

- `id`
- `user_id`
- `query_name`
- `selected_company_name`
- `selected_credit_code`
- `source_name`
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
- `created_at`

注意：

- `raw_payload` 保存原始返回，便于追溯。
- `mapped_profile` 保存映射后的企业画像草稿。
- `confidence` 标识字段可信度，不能把推断字段伪装成事实。
- `ai_extracted_profile` 保存 DeepSeek 解耦后的结构化草稿，必须通过 schema 校验后才能展示。
- `missing_fields` 保存需要用户补充的字段清单，尤其是财务、纳税、研发、社保和申报项目字段。

## 合规与风险

- 不绕过验证码、登录、反爬限制。
- 优先使用官方开放数据接口或合法商业 API。
- 自动补全字段需要展示数据来源。
- 用户必须确认自动补全结果。
- 对营收、利润、纳税、研发等内部字段，不要从不可靠网页猜测。
- 报告中需要区分“公开信息自动补全”和“用户自行填写”。
- DeepSeek 不是事实来源，所有 AI 推断都要标记来源和置信度。
- DeepSeek 输出非法 JSON、字段越界或引用不存在的数据源时，应丢弃本次 AI 结果并允许用户手动填写。

## 参考资料

- 深圳市政府数据开放平台统一社会信用代码信息：https://opendata.sz.gov.cn/data/api/toApiDetails/29200_01300275
- 深圳信用网：https://www.szcredit.org.cn/
- 深圳市市场监督管理局商事主体信用监管公示平台：https://amr.sz.gov.cn/xyjggs.webui/xyjggs/index.aspx
- 高新技术企业认定管理工作网查询服务：https://www.innocom.gov.cn/gqrdw/c101322/cxfw.shtml
- 科学技术部政务服务平台科技型中小企业查询：https://fuwu.most.gov.cn/html/fwcx/kjxzxqy/
- 科技型中小企业服务查询：https://innofund.chinatorch.org.cn/zxqyfw/cxfw/cxfw.shtml
- 深圳市专精特新中小企业公示公告示例：https://www.sz.gov.cn/cn/xxgk/zfxxgj/tzgg/content/post_12595050.html
- 国家知识产权局：https://www.cnipa.gov.cn/
- 企查查开放平台：https://mapi.qcc.com/dataApi
- DeepSeek Chat Completion API：https://api-docs.deepseek.com/api/create-chat-completion
- DeepSeek Function Calling Guide：https://api-docs.deepseek.com/guides/function_calling
