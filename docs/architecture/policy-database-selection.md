# 惠企政策库数据库选型建议

调研日期：2026-07-02

## 结论

本项目建议生产环境优先使用 PostgreSQL。

SQLite 可以作为本地开发、爬虫中间缓存、单机 MVP 的临时方案；MongoDB 不建议作为第一版主库。原因是这个项目不是单纯“存一堆政策原文”，而是要做企业画像、政策条件、申报窗口、匹配结果、解释报告之间的稳定关联和可追溯计算。

推荐路线：

1. 生产主库：PostgreSQL。
2. 原始抓取缓存：可以用 SQLite 或 PostgreSQL 的 `raw_payload` 字段。
3. 附件文件：不要直接塞进数据库，放服务器文件目录或对象存储，数据库保存 URL、文件哈希、解析状态。
4. 后续如果需要语义检索，再在 PostgreSQL 旁边增加向量检索能力或独立搜索服务，不在第一版引入复杂架构。

## 为什么 PostgreSQL 更适合

### 1. 政策匹配天然是关系型问题

本项目核心数据关系包括：

- 一个政策对应多个条款。
- 一个条款对应多个适用条件。
- 一个政策对应多个行业、标签、发布部门、申报批次、附件。
- 一个企业画像会产生多条匹配结果。
- 一次匹配要保存输入快照、命中条件、缺失条件、建议动作和报告。

这些关系用关系型数据库表达更直接，也方便做审计和解释。

### 2. 同时需要结构化字段和半结构化字段

政策网页抓取来的字段会有差异，例如不同部门页面的附件、申报公告、咨询电话、资金字段不一定完全一致。PostgreSQL 可以用普通列保存稳定字段，用 `jsonb` 保存原始字段和可变字段。

官方 PostgreSQL 文档说明 `jsonb` 支持 JSON 数据校验、JSON 操作函数和索引，通常应用应优先选择 `jsonb` 而不是 `json`，除非有保留键顺序等特殊需求。

### 3. 政策检索需要全文搜索和索引

政策匹配前需要先按区域、行业、有效性、企业特色、申报状态、关键词缩小候选集合。PostgreSQL 支持全文搜索，并且官方文档明确可用 GIN/GiST 索引加速全文搜索。

第一版可以用：

- 普通 B-tree 索引：区域、发布机构、有效性、年份、申报状态。
- GIN 索引：全文检索向量、标签数组、`jsonb` 原始字段。
- 后续再增加中文分词或向量检索。

### 4. 轻量服务器也能部署

腾讯云轻量服务器上可以用 Docker Compose 部署：

- Web/API 服务
- PostgreSQL
- 定时采集任务
- Nginx

如果服务器内存只有 1GB，PostgreSQL 需要保守配置，或者先用 SQLite 做演示版。如果是 2GB 以上内存，第一版政策库规模不大，PostgreSQL 更值得直接上。

## SQLite 是否可行

可行，但更适合作为原型或低并发单机方案。

SQLite 官方定位是嵌入式、无服务、零配置的 SQL 数据库。官方文档也说明它适合大多数低到中等流量网站，但同时指出高写入、高并发、多服务器或大量并发写入场景更适合客户端/服务器型数据库。SQLite 同一时间只允许一个 writer。

对本项目的判断：

适合 SQLite 的部分：

- 本地开发。
- 爬虫临时缓存。
- 数据清洗中间结果。
- 单用户演示版。
- 每晚批量抓取后只读查询。

不建议把 SQLite 作为长期生产主库的原因：

- 后续 Web 请求、爬虫写入、管理员编辑、报告生成可能并发写库。
- 备份、迁移、权限、远程维护能力不如 PostgreSQL 清晰。
- 将来如果要多实例部署 API，SQLite 会成为明显约束。
- 政策匹配解释需要较多关联查询和审计表，PostgreSQL 更容易扩展。

## MongoDB 是否可行

可行，但不是本项目第一选择。

MongoDB 的优势是文档模型和灵活 schema。官方文档说明同一集合中的文档可以不拥有完全相同的字段，适合数据结构持续变化的文档型应用。

本项目确实有“政策原文和抓取字段不统一”的部分，看起来像 MongoDB 的优势。但核心难点不是保存原文，而是：

- 条件拆解。
- 结构化匹配。
- 多条件解释。
- 政策版本追踪。
- 申报窗口和附件关联。
- 企业画像和匹配结果审计。

这些更像关系型和规则引擎问题。用 MongoDB 也能做，但会更依赖应用层维护关系和一致性，后续解释报告、筛选统计、条件缺失分析会更绕。

MongoDB 更适合的情况：

- 项目主要是政策文档检索，不强调规则解释。
- 每条政策差异非常大，不打算强结构化。
- 团队已经熟悉 MongoDB 运维和建模。
- 使用托管 MongoDB 服务，不想在轻量服务器上自己维护。

## 建议的数据模型

第一版可以按下面的表拆分：

### source_documents

保存原始抓取结果。

核心字段：

- `id`
- `source_name`
- `source_url`
- `fetched_at`
- `raw_title`
- `raw_html`
- `raw_text`
- `raw_payload jsonb`
- `content_hash`
- `parse_status`

用途：保证可追溯，页面结构变化时能重新解析。

### policies

保存标准化政策主表。

核心字段：

- `id`
- `title`
- `policy_code`
- `issuer`
- `region`
- `publish_date`
- `effective_start`
- `effective_end`
- `valid_status`
- `policy_level`
- `source_url`
- `interpretation_url`
- `apply_notice_url`
- `summary`
- `raw_payload jsonb`

### policy_rules

保存拆解后的匹配规则。

核心字段：

- `id`
- `policy_id`
- `rule_type`
- `field_key`
- `operator`
- `expected_value`
- `weight`
- `is_required`
- `evidence_text`

示例：

- `registered_region = 龙华区`
- `industry in 制造业, 软件和信息技术服务业`
- `qualification contains 专精特新`
- `revenue_growth >= 10%`

### policy_applications

保存申报批次和窗口期。

核心字段：

- `id`
- `policy_id`
- `batch_name`
- `start_time`
- `end_time`
- `status`
- `apply_url`
- `materials`
- `contact_phone`
- `notice_url`

### enterprises

保存企业画像。

核心字段：

- `id`
- `name`
- `registered_region`
- `operation_region`
- `industry`
- `scale`
- `qualifications`
- `revenue`
- `rd_expense`
- `employee_count`
- `tax_status`
- `profile_payload jsonb`

### match_runs

保存一次匹配任务。

核心字段：

- `id`
- `enterprise_id`
- `input_snapshot jsonb`
- `created_at`
- `engine_version`
- `summary`

### match_results

保存政策匹配结果。

核心字段：

- `id`
- `match_run_id`
- `policy_id`
- `score`
- `match_level`
- `matched_rules jsonb`
- `missing_rules jsonb`
- `risk_notes`
- `suggested_actions`

### reports

保存用户可下载的汇总报告。

核心字段：

- `id`
- `match_run_id`
- `report_type`
- `content_markdown`
- `file_url`
- `created_at`

## 第一版实现建议

### 技术组合

- 数据库：PostgreSQL。
- ORM：Prisma 或 Drizzle。若前后端都用 TypeScript，Prisma 上手更快，Drizzle 更轻。
- 后端：Node.js + Fastify/NestJS，或 Next.js API Routes。
- 定时采集：Node 脚本或 Python 脚本均可，但结果写入统一数据库。
- 部署：Docker Compose 部署 Web/API、PostgreSQL、Nginx。
- 备份：每天 `pg_dump`，保留 7 到 30 天。

### 数据流

1. 采集政策文件库和部门公告。
2. 写入 `source_documents`。
3. 解析成 `policies`、`policy_applications`、`policy_rules`。
4. 用户录入企业画像。
5. 规则引擎先筛选候选政策，再逐条计算分数。
6. 写入 `match_runs` 和 `match_results`。
7. 生成 Markdown/HTML/PDF 报告。

## 取舍

| 方案 | 优点 | 缺点 | 结论 |
| --- | --- | --- | --- |
| SQLite | 简单、零配置、适合本地和 MVP | 并发写、远程维护、扩展性弱 | 可做开发和演示，不建议长期生产主库 |
| MongoDB | 文档灵活，适合原始政策文档 | 条件匹配和解释关系会变复杂 | 不作为第一版主库 |
| PostgreSQL | 关系清晰、JSONB 灵活、全文搜索、事务和索引成熟 | 运维比 SQLite 多一点 | 推荐作为生产主库 |

## 当前项目的推荐决策

如果目标是毕业设计/作品集/实习展示，并且未来真要部署到腾讯云轻量服务器：

1. 直接用 PostgreSQL 做主库。
2. 用 `jsonb` 保留原始政策字段，避免因为字段不统一而频繁改表。
3. 用规范化表表达政策、规则、企业画像、匹配结果和报告。
4. SQLite 只作为本地临时缓存，不进入生产主路径。
5. 不优先使用 MongoDB，除非后续明确要做“文档检索平台”而不是“政策匹配解释系统”。

## 参考资料

- SQLite 官方：Appropriate Uses For SQLite https://sqlite.org/whentouse.html
- SQLite 官方：About SQLite https://sqlite.org/about.html
- MongoDB 官方：Document Database / Flexible Schema https://www.mongodb.com/resources/basics/databases/document-databases
- MongoDB 官方：Why Use MongoDB https://www.mongodb.com/resources/products/fundamentals/why-use-mongodb
- PostgreSQL 官方：JSON Types https://www.postgresql.org/docs/current/datatype-json.html
- PostgreSQL 官方：JSON Functions and Operators https://www.postgresql.org/docs/current/functions-json.html
- PostgreSQL 官方：Text Search Functions and Operators https://www.postgresql.org/docs/current/functions-textsearch.html
- PostgreSQL 官方：Preferred Index Types for Text Search https://www.postgresql.org/docs/current/textsearch-indexes.html
