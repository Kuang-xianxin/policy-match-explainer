# Policy Match Explainer - Agent Notes

## Project

- Project name: 企业政策匹配解释网站 (`policy-match-explainer`)
- Project root: `D:\my project\policy-match-explainer`
- GitHub remote: `https://github.com/Kuang-xianxin/policy-match-explainer.git`
- This file is the project's persistent agent context and core design document. At the start of each future project round, read this file first and follow it.
- Unless explicitly stated otherwise, all project folders and files should be created under `D:\my project\policy-match-explainer`.

## Enterprise Profile Input Architecture

- The current MVP enterprise profile input is fully manual. The user manually enters company name, credit code, business fields, financial fields, R&D fields, compliance fields, and project fields.
- Do not expose company-name lookup, AI profile extraction, AI field decomposition, or automatic enterprise profile import in the profile input page.
- DeepSeek remains available for policy match review and report writing after the user saves a manually entered profile.
- Do not use DeepSeek or any LLM prompt to fabricate enterprise registry facts, enterprise operating data, financial data, tax data, R&D data, social security data, customer type, or project fields.
- A future Longhua enterprise registry, if reintroduced, should be a separate optional local searchable index/cache built from authorized providers, not an unauthorized copied full registry or a crawler that bypasses public query restrictions.

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
