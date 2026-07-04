# Company Profile Autofill Backtest

Date: 2026-07-04

## Purpose

The user expects a company short name, such as `汇川技术`, to produce a useful enterprise profile for policy matching. This backtest checks the current API against real companies that are not in the local demo enterprise library.

## Current System Result

Endpoint flow tested:

1. `POST /api/company-lookup/search`
2. `POST /api/company-lookup/:id/generate-profile`

All samples below fell through to the `inferred` fallback instead of a real enterprise-data source.

| Query | Generated candidate | Source | Credit code | Registered year | Employee | Tax | Result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 汇川技术 | 深圳市汇川技术科技有限公司 | inferred | `UNCONFIRMED-*` | 2026 | 0 / unknown | 0 / unknown | Wrong entity and missing facts |
| 深圳市汇川技术股份有限公司 | 深圳市汇川技术股份有限公司 | inferred | `UNCONFIRMED-*` | 2026 | 0 / unknown | 0 / unknown | Correct name text but unverified and missing facts |
| 科达利 | 深圳市科达利科技有限公司 | inferred | `UNCONFIRMED-*` | 2026 | 0 / unknown | 0 / unknown | Wrong entity type and missing facts |
| 深圳市科达利实业股份有限公司 | 深圳市科达利实业股份有限公司 | inferred | `UNCONFIRMED-*` | 2026 | 0 / unknown | 0 / unknown | Correct name text but unverified and missing facts |
| 英维克 | 深圳市英维克科技有限公司 | inferred | `UNCONFIRMED-*` | 2026 | 0 / unknown | 0 / unknown | Wrong entity type and missing facts |
| 深圳市英维克科技股份有限公司 | 深圳市英维克科技股份有限公司 | inferred | `UNCONFIRMED-*` | 2026 | 0 / unknown | 0 / unknown | Correct name text but unverified and missing facts |

## Public Evidence Check

Public pages show that useful profile fields exist online, but the current backend never retrieves them:

- 汇川技术: the official investor page exposes a Shenzhen Longhua contact address; public company introductions and reports expose establishment year, business direction, employee scale, revenue, and R&D data. Sources: <https://www.inovance.com/investor>, <https://money.finance.sina.com.cn/corp/view/vCB_AllBulletinDetail.php?id=11361373&stockid=300124>
- 科达利: official pages expose Longhua headquarters address, establishment month/year, business direction, employee count, revenue, R&D staff count, patents, and stock code. Sources: <https://www.kedali.com.cn/contact.html>, <https://www.kedali.com.cn/about/>
- 英维克: official and Longhua government pages expose establishment year, listing status, Longhua headquarters/project information, business direction, production-base/project information, and product lines. Sources: <https://www.envicool.com/about.html>, <https://www.szlhq.gov.cn/lhzdqyjstjzx/gkmlpt/content/12/12238/post_12238340.html>

## Root Cause

The current implementation does not have a real evidence retrieval layer:

- `/api/company-lookup/search` searches only the local demo company seed data and then creates an `inferred` fallback.
- The fallback payload intentionally uses synthetic `UNCONFIRMED-*` credit codes and placeholder Longhua assumptions.
- `extractEnterpriseProfile` can only extract fields from the raw payload it receives. It cannot recover legal representative, establishment date, tax, employee, project, or R&D facts when those facts were never retrieved.
- DeepSeek chat completion can structure text and call functions provided by the app, but the API does not automatically browse the web or query enterprise registries. Official docs: <https://api-docs.deepseek.com/> and <https://api-docs.deepseek.com/api/create-chat-completion>.

## Production-Fit Direction

The feature should be rebuilt as an evidence-first pipeline:

1. User enters incomplete company name.
2. DeepSeek normalizes the query and proposes search keywords.
3. Backend `EnterpriseResearchProvider` retrieves candidate evidence from configured providers:
   - Commercial enterprise registry API for legal representative, credit code, establishment date, status, registered capital, registered address.
   - Search API such as Bing, SerpAPI, Tavily, or Brave for official websites, government pages, annual reports, and news pages.
   - PostgreSQL local cache for repeat queries and curated Longhua enterprise records.
4. Backend stores raw evidence snippets, URLs, retrieval time, provider name, and confidence.
5. DeepSeek extracts a typed enterprise profile only from the retrieved evidence.
6. The UI shows field-level source and confidence. Unknown or non-public fields stay `unknown` or use user-confirmed ranges.

## Data Source Decision Needed

Recommended first implementation path:

- Use a search API provider for official/government/annual-report evidence plus PostgreSQL caching. Current price research favors Doubao Search for the first search provider because its listed web-search call price is lower than Baidu Qianfan Search. See `docs/research/ai-search-provider-price-comparison.md`.
- Keep paid enterprise registry APIs optional, because they require provider approval, cost, and API credentials.
- Add tests with real non-demo company abbreviations and mocked evidence fixtures, not only seed-library companies.

If exact legal representative and current registry status are mandatory, a commercial registry API is the more reliable first data source. If the MVP can tolerate field-level evidence and `unknown` values for unavailable internal data, search API plus official-source extraction is enough for the next version.
