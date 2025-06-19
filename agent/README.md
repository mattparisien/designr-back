# Agent Service

This folder contains a small wrapper around the OpenAI Responses API used to build the `ProjectAgentService`.

## Available Tools

The agent exposes a hosted `web_search` tool along with several custom function tools:

- `search_assets` – query the user's asset library.
- `search_docs` – search uploaded document text.
- `normalize_search_results` – convert web search snippets into design elements.
- `create_social_media_project` – generate a social media project with platform‑specific dimensions.

## Configuration

1. Provide an OpenAI API key via `OPENAI_API_KEY`.
2. Optional variables:
   - `OPENAI_MODEL` – model name (default `gpt-4o-mini`).
   - `APP_NAME` – application name shown in prompts.
   - `BACKEND_URL` – base URL for project creation requests.
3. Services for vector search and image analysis can be passed when creating the agent.

## Example Usage

```ts
import { buildAgent } from "./agent";

const agent = buildAgent();

const response = await agent.run(
  "Create an Instagram post about summer biking tips"
);

console.log(response.finalOutput);
```

The `ProjectAgentService` wraps this agent and exposes `chat` and `chatWithHistory` helpers for use in the application.
