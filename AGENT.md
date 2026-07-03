# Policy Match Explainer - Agent Notes

## Project

- Project name: 企业政策匹配解释网站 (`policy-match-explainer`)
- Project root: `D:\my project\policy-match-explainer`
- GitHub remote: `https://github.com/Kuang-xianxin/policy-match-explainer.git`
- This file is the project's persistent agent context and core design document. At the start of each future project round, read this file first and follow it.
- Unless explicitly stated otherwise, all project folders and files should be created under `D:\my project\policy-match-explainer`.

## Enterprise Lookup Architecture

- Do not use DeepSeek or any LLM prompt to fabricate enterprise registry facts.
- The company-name lookup flow is: user query -> LLM query planning -> backend data-source provider lookup -> raw payload storage -> LLM field extraction -> user confirmation -> policy matching/report.
- DeepSeek can normalize the query, split search keywords, suggest data sources, extract profile fields from `raw_payload`, review policy matches, and draft reports.
- Real enterprise facts must come from backend providers such as official open-data APIs, commercial company registry APIs, or a maintained internal policy/company data store.
- The current MVP provider is `MVP demo company registry`; it is only for flow demonstration and must be labelled as demo data.

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
