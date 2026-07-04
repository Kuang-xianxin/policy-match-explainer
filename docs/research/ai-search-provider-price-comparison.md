# AI Search Provider Price Comparison

Date: 2026-07-04

## Scope

This note compares Baidu Qianfan AI Search and Volcano Engine Doubao Search for the enterprise-profile autofill pipeline.

The target workflow is:

1. Search evidence for an incomplete company name.
2. Return source URLs, page titles, snippets, dates, and provider metadata.
3. Let a model extract typed enterprise-profile fields only from evidence.
4. Keep unknown or user-confirmed ranges for private fields.

## Official Price Snapshot

### Baidu Qianfan AI Search

Official docs:

- Baidu Search API: <https://cloud.baidu.com/doc/qianfan-api/s/Wmbq4z7e5>
- Intelligent Search Generation API: <https://cloud.baidu.com/doc/qianfan-api/s/Hmbu8m06u>
- Qianfan pricing page: <https://cloud.baidu.com/doc/qianfan-docs/s/Jm8r1826a>

Observed pricing from the official pricing page:

- Baidu Search: `0.036 CNY / call`
- Intelligent Search Generation: `0.06 CNY / call`
- Limited-time discounted Intelligent Search Generation: `0.008 CNY / call`
- Intelligent Search Generation already includes Baidu Search cost, but model token usage is billed separately.
- Deep search may create up to 10 Intelligent Search Generation service calls, billed by actual call count.

Note: Baidu docs currently show slightly different free-quota wording across pages. Treat the console billing page as the final source before production launch.

### Volcano Engine Doubao Search

Official docs:

- Doubao Search billing: <https://www.volcengine.com/docs/87772/2272951?lang=zh>
- Ark model pricing: <https://www.volcengine.com/docs/82379/1544106?lang=zh>

Observed pricing from the official billing page:

- Doubao Search Custom web search: `0.020 CNY / call`
- Doubao Search Global web search: `0.020 CNY / call`
- Old web search summary edition: `0.025 CNY / call`, but the official billing page says new activation is no longer supported after 2026-06-23.
- Old summary token-billing option: input `0.0064 CNY / 1k tokens`, output `0.0133 CNY / 1k tokens`, also tied to the old summary edition.

Public official model-pricing snippets for Doubao Seed models show low token prices for normal extraction workloads, but the exact production model should still be confirmed in the Volcano console.

## Cost Estimate For This Project

Assume one enterprise-profile lookup uses 3 to 5 search queries:

| Provider | Search unit price | Search-only cost / company | Search-only cost / 1,000 companies |
| --- | ---: | ---: | ---: |
| Doubao Search | 0.020 CNY / call | 0.060 - 0.100 CNY | 60 - 100 CNY |
| Baidu Search | 0.036 CNY / call | 0.108 - 0.180 CNY | 108 - 180 CNY |
| Baidu Intelligent Search Generation | 0.060 CNY / call before tokens | depends on call count | 60 CNY+ for one call each, higher with deep search |

Pure search cost conclusion:

- Doubao Search is cheaper than Baidu Search by about 44%.
- Baidu Intelligent Search Generation can be cheaper only during the limited-time `0.008 CNY / call` discount, but it still has extra model-token billing and the discount is not a stable long-term architecture assumption.

## Recommendation

For the next implementation:

1. Use a provider interface so the backend can switch between `doubao_search`, `qianfan_search`, and `disabled`.
2. Use Doubao Search first for normal evidence retrieval because its listed search-call price is lower.
3. Keep Baidu Qianfan Search as a fallback or comparison source, especially when Doubao recall is weak for official/government/company pages.
4. Cache search evidence in PostgreSQL by normalized company name and provider to avoid repeated paid calls.
5. Do not rely on black-box search summaries as factual fields. Store URLs, titles, snippets, dates, provider name, retrieval time, and confidence, then run typed extraction from that evidence.

This is the most cost-effective production path for the current MVP: cheap search first, source traceability always, and model extraction only after evidence retrieval.
