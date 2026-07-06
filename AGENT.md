# Policy Match Explainer - Agent Notes

## Project

- Project name: 企业政策匹配解释网站 (`policy-match-explainer`)
- Project root: `D:\my project\policy-match-explainer`
- GitHub remote: `https://github.com/Kuang-xianxin/policy-match-explainer.git`
- This file is the project's persistent agent context and core design document. At the start of each future project round, read this file first and follow it.
- Unless explicitly stated otherwise, all project folders and files should be created under `D:\my project\policy-match-explainer`.

## Enterprise Profile Input Architecture

- The current MVP enterprise profile input uses AI-assisted lightweight profile generation. The primary flow is: user enters an incomplete company name, DeepSeek plans normalized search keywords, the backend searches a local/authorized Longhua enterprise index, the user selects one candidate, and the system generates a draft enterprise profile for user confirmation.
- Enterprise profile autofill must be evidence-first. DeepSeek may plan queries, rank candidates, extract fields, and write explanations, but it is not itself a trusted enterprise registry or live web-search data source. The backend must provide evidence from an authorized search provider, official/open data source, commercial enterprise-data API, user-uploaded material, or the maintained local Longhua enterprise index before claiming a field is factual.
- Do not use paid enterprise data APIs unless the user explicitly approves that cost and provider. The current MVP uses a local Longhua demo enterprise index that can later be replaced by authorized official/open data providers.
- Multiple company candidates must be shown to the user for selection. Do not silently choose an ambiguous candidate.
- If no local/authorized enterprise index candidate or web-search evidence can verify that the company is a Shenzhen Longhua District enterprise, the system must hard-block the company lookup flow with a clear user-facing warning. Do not create `inferred` profile drafts, `UNCONFIRMED-*` credit codes, default Longhua addresses, or `xxx（待确认主体）` candidates.
- The company lookup flow is evidence-first and candidate-only: a corresponding verified Longhua enterprise can be selected; if none is verified, return no candidate and explain that the system cannot generate a matchable enterprise profile.
- Verified correction sample: the Longhua company behind `华傲数据` is `深圳市华傲数据技术有限公司`, not `深圳市华傲数据科技有限公司`; keep this case in regression tests and the curated public evidence index.
- DeepSeek may infer low-risk business fields from a selected raw company payload, such as business summary, products, customer type, business model, and project direction. It must not be used as the source of enterprise registry facts. Registry facts include legal representative, unified social credit code, establishment date, registered address, registered capital, business status, and administrative district.
- DeepSeek or any LLM prompt must not fabricate revenue, profit, tax paid, R&D expense, R&D employee count, social security status, project budget, or other internal operating data. Those fields must be user-confirmed through range selectors or explicit manual editing, with `unknown` supported.
- Publicly reported values such as listed-company employee count, revenue, R&D expense, patents, awards, projects, and production-base information may be extracted only when the source evidence is retained with field-level confidence and source URL/name. If evidence is unavailable or stale, keep the field as `unknown` or ask the user to choose a range.
- Backtests for the company-name autofill feature must include non-demo-library companies and abbreviated names, such as public Longhua companies or user-provided real examples. Do not validate this feature only with the built-in seed/demo enterprise library.
- Backtests must also include Longhua companies that are not in the maintained local/curated enterprise index, such as `深圳市乐牙科技有限公司`, `深圳市有方科技股份有限公司`, `深圳市杰普特光电股份有限公司`, and `深圳市科达利实业股份有限公司`, to ensure unknown samples never match a known company through generic keywords.
- AI query-planning keywords are not evidence. Generic keywords such as `深圳`, `龙华区`, `科技公司`, `软件`, or `大数据` must not be sufficient to match a curated enterprise record.
- AI search providers must remain configurable. Prefer a backend provider interface so `doubao_search`, `qianfan_search`, a commercial enterprise registry API, and `disabled` can be swapped without rewriting the profile flow. Current cost research favors Doubao Search for first-pass web evidence retrieval, with Baidu Qianfan Search available as fallback/comparison.
- Default Doubao model for this project is `doubao-seed-2-0-mini-260428` after the user opened the corresponding Ark model and web-search capability. If `DOUBAO_MODEL` is set to the display name `Doubao-Seed-2.0-mini`, normalize it to the real Ark model id. Keep `DOUBAO_MODEL` configurable so production can move to another authorized Seed model after confirming price and availability.
- Use `ARK_API_KEY` as the preferred Volcano Ark credential name. Keep `DOUBAO_API_KEY` only as a backward-compatible alias; a stale `DOUBAO_API_KEY` must not shadow a valid Ark key.
- Local Windows Clash Verge/Mihomo TUN fake-ip can resolve `ark.cn-beijing.volces.com` to `198.18.*` and break TLS with `ECONNRESET`. The backend keeps a Doubao direct fallback that uses DoH A-record resolution plus a physical IPv4 local address; keep `DOUBAO_DIRECT_FALLBACK`, `DOUBAO_RESOLVE_IP`, and `DOUBAO_LOCAL_ADDRESS` configurable.
- The matcher must keep deterministic rule scoring as the baseline. DeepSeek remains available for policy match review and report writing after the user saves a confirmed profile.
- Matching and report writing should keep the current split: deterministic rule baseline first, DeepSeek semantic review/report second, Doubao联网搜索 only for enterprise profile evidence retrieval unless a future requirement proves web search is needed in policy review.
- The profile edit page should expose required and optional fields directly. Do not hide optional fields behind an advanced-editor-only interaction; the user should see required fields first, then range/qualification fields, then optional evidence fields.
- Long-running user operations must show an expected time range and visible progress. This applies to candidate company search, selected-candidate profile generation, smart profile generation plus matching, and saved-profile policy matching.
- Report generation must have a prominent call-to-action and an obvious completion notice. After a report is generated, the UI should clearly tell the user where the report appeared.
- Saved enterprise profiles are user-scoped and de-duplicated by normalized unified social credit code. Saving the same company again should update the user's latest profile for that credit code instead of creating another visible saved-profile row. Existing historical duplicate rows should be hidden from the saved-profile list by returning only the newest row per credit code.
- Any future Longhua enterprise registry must be a separate optional local searchable index/cache built from authorized providers, not an unauthorized copied full registry or a crawler that bypasses public query restrictions.

## Longhua Policy Source Library

- The local Longhua policy library must separate raw public-source capture from derived match rules.
- `source_documents` stores public Longhua policy files, application guides, department notices, policy interpretations, source URLs, list URLs, publish dates, departments, raw HTML, extracted text, attachments, and raw payload metadata.
- `policies` stores the subset of source documents that are suitable for enterprise-profile matching. Policy interpretations should remain available in `source_documents` but should not directly flood match results.
- The collector command is `npm run db:collect:longhua`. It must run after PostgreSQL is up and migrations are applied.
- The collector may only access publicly reachable web pages. Do not bypass login, captcha, enterprise authentication, mobile-app restrictions, or site access controls.
- Imported policy records can have empty `rules` until a later structured-policy extraction step. Do not imply that raw imported policy text has already been converted into high-confidence weighted rules.
- If local Windows network/TUN/DNS breaks TLS access to `www.szlhq.gov.cn`, run the same collector on the Tencent Cloud server or another normal network environment and record the failure honestly.

## Local Database Architecture

- Local development PostgreSQL should use the project Docker service on host port `15432`, not the machine-global PostgreSQL service on `5432`.
- Default local `DATABASE_URL` is `postgres://policy_user:policy_password@localhost:15432/policy_match`.
- If database authentication fails for `policy_user`, first run `npm run db:up` and `npm run db:check`; do not change the password of an unrelated local PostgreSQL installation.
- `db:reset` is guarded and should only run against the project development/test database. Use `ALLOW_DB_RESET=true` only after confirming `DATABASE_URL`.

## Round Log Requirement

The project must keep a JSON Lines log file named `rounds.jsonl`.

This requirement is mandatory for every future programming-agent conversation in this project. At the start of each round, check the latest `round_id`; before finishing, append the new round record. If a round is read-only or makes no project modification, set `modify_diff` to an empty string and `commit_hash` to `NO_COMMIT`. If an earlier round was missed, add a truthful retrospective record and mark the reason in `prompt_content` or `modify_diff` instead of silently leaving the gap.

For every conversation round with a programming agent, append exactly one JSON object line to `rounds.jsonl`. `round_id` starts from `1`, increases by `1` each round, and must be unique.

Each JSON object must include these fields:

- `round_id`: string or number. Interaction round number, starting from 1, increasing, unique, and not repeated.
- `prompt_content`: string. The complete natural-language instruction and requirement description given to the programming agent in this round.
- `modify_diff`: string. The complete diff of code/project changes made by the agent in this round, including added, deleted, and modified lines.
- `commit_hash`: string. The Git commit hash associated with this round's project modification.
- `modify_time`: string. The modification time for this round, formatted as `YYYY-MM-DD HH:MM:SS`.
- `agent_type`: string. The programming agent type used in this round.
- `dev_language`: string. The programming language or artifact language used for development in this round.

Field values must be filled truthfully.

Because a Git commit hash is only known after a commit is created, and because recording the `rounds.jsonl` line inside its own `modify_diff` would create a recursive self-reference, use this convention for rounds with project modifications:

1. Finish the actual project changes for the round.
2. Commit those project changes and get the commit hash.
3. Append one JSON object to `rounds.jsonl` using that commit hash.
4. In `modify_diff`, record the real project diff for the round, but do not recursively include the newly appended `rounds.jsonl` line itself.

Use the local project time zone when writing `modify_time`.
