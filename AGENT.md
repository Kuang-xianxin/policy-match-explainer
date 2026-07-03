# Policy Match Explainer - Agent Notes

## Project

- Project name: 企业政策匹配解释网站 (`policy-match-explainer`)
- Project root: `D:\my project\policy-match-explainer`
- GitHub remote: `https://github.com/Kuang-xianxin/policy-match-explainer.git`
- This file is the project's persistent agent context and core design document. At the start of each future project round, read this file first and follow it.
- Unless explicitly stated otherwise, all project folders and files should be created under `D:\my project\policy-match-explainer`.

## Enterprise Profile Input Architecture

- The current MVP enterprise profile input uses AI-assisted lightweight profile generation. The primary flow is: user enters an incomplete company name, DeepSeek plans normalized search keywords, the backend searches a local/authorized Longhua enterprise index, the user selects one candidate, and the system generates a draft enterprise profile for user confirmation.
- Do not use paid enterprise data APIs unless the user explicitly approves that cost and provider. The current MVP uses a local Longhua demo enterprise index that can later be replaced by authorized official/open data providers.
- Multiple company candidates must be shown to the user for selection. Do not silently choose an ambiguous candidate.
- DeepSeek may infer low-risk business fields from a selected raw company payload, such as business summary, products, customer type, business model, and project direction. It must not be used as the source of enterprise registry facts.
- DeepSeek or any LLM prompt must not fabricate revenue, profit, tax paid, R&D expense, R&D employee count, social security status, project budget, or other internal operating data. Those fields must be user-confirmed through range selectors or explicit manual editing, with `unknown` supported.
- The matcher must keep deterministic rule scoring as the baseline. DeepSeek remains available for policy match review and report writing after the user saves a confirmed profile.
- Any future Longhua enterprise registry must be a separate optional local searchable index/cache built from authorized providers, not an unauthorized copied full registry or a crawler that bypasses public query restrictions.

## Local Database Architecture

- Local development PostgreSQL should use the project Docker service on host port `15432`, not the machine-global PostgreSQL service on `5432`.
- Default local `DATABASE_URL` is `postgres://policy_user:policy_password@localhost:15432/policy_match`.
- If database authentication fails for `policy_user`, first run `npm run db:up` and `npm run db:check`; do not change the password of an unrelated local PostgreSQL installation.
- `db:reset` is guarded and should only run against the project development/test database. Use `ALLOW_DB_RESET=true` only after confirming `DATABASE_URL`.

## Round Log Requirement

The project must keep a JSON Lines log file named `rounds.jsonl`.

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

Because a Git commit hash is only known after a commit is created, and because recording the `rounds.jsonl` line inside its own `modify_diff` would create a recursive self-reference, use this convention:

1. Finish the actual project changes for the round.
2. Commit those project changes and get the commit hash.
3. Append one JSON object to `rounds.jsonl` using that commit hash.
4. In `modify_diff`, record the real project diff for the round, but do not recursively include the newly appended `rounds.jsonl` line itself.

Use the local project time zone when writing `modify_time`.
