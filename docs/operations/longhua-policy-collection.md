# 龙华区公开政策库采集说明

## 目标

把公开网页上可访问的龙华区政策文件、申报指南、部门公告、政策解读采集到 PostgreSQL，形成可追溯的本地政策资料库。

采集结果分两层保存：

- `source_documents`：保存所有采集到的公开网页文档，包括政策文件、申报指南、部门公告、政策解读、正文、附件链接、原始 HTML、来源 URL、发布日期和发布部门。
- `policies`：只同步适合参与企业画像匹配的政策文件、申报指南、企业相关部门公告。政策解读仍保存在 `source_documents`，避免解释文章直接进入匹配结果造成噪声。

## 默认公开来源

- 政策性文件：`https://www.szlhq.gov.cn/xxgk/zcfg/qgfxwj/qzcxwj/index.html`
- 文字解读：`https://www.szlhq.gov.cn/xxgk/zcfg/zcjd/qnzcjd/index.html`
- 图解政策：`https://www.szlhq.gov.cn/xxgk/zcfg/zcjd/mtjd/index.html`
- 音频解读：`https://www.szlhq.gov.cn/xxgk/zcfg/zcjd/ypjd/index.html`
- 通知公告：`https://www.szlhq.gov.cn/xxgk/xwzx/tzgg/index.html`

采集器只访问公开网页，不绕过登录、验证码、企业认证或移动端限制。

## 运行命令

```bash
npm run db:up
npm run db:migrate
npm run db:collect:longhua
```

只验证抓取但不写入业务数据：

```bash
npm run db:collect:longhua -- --dry-run
```

## 可选环境变量

- `LONGHUA_COLLECT_MAX_PAGES`：统一限制每个来源最多采集多少页。
- `LONGHUA_COLLECT_NOTICE_MAX_PAGES`：单独限制通知公告最多采集多少页。
- `LONGHUA_COLLECT_DELAY_MS`：请求间隔，默认 `200` 毫秒。

示例：

```bash
LONGHUA_COLLECT_NOTICE_MAX_PAGES=300 npm run db:collect:longhua
```

## 入库口径

采集器会从列表页提取详情链接，再访问详情页，保留：

- 标题
- 来源 URL
- 列表 URL
- 文档类型
- 发布部门
- 发布日期
- 正文纯文本
- 原始 HTML
- PDF/Word/Excel/Zip/Rar 附件链接
- 内容哈希

`policies` 的规则字段暂时写入空数组 `[]`。这代表该政策已经进入本地资料库，但还没有拆解成可解释匹配规则。后续应由人工或 LLM 辅助把重点政策拆成结构化条件，再参与高质量匹配。

## 网络注意事项

如果本地 Windows 代理/TUN/DNS 导致 `www.szlhq.gov.cn` TLS 连接失败，采集命令会输出列表页或详情页失败信息。此时优先在腾讯云服务器或普通网络环境运行同一命令；不要为了抓取公开网页去绕过网站访问控制。
