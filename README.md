# Canva Clone Backend

This repository contains a backend service used for experimentation with a Canva‑style project creation workflow. It exposes a chat interface backed by OpenAI and includes a set of utility debug scripts.

## Debugging Scripts

Several scripts are provided in the repository root to make it easier to manually exercise pieces of the chat agent.

- **debug-call-structure.js** – Runs the agent with a sample prompt so you can inspect the tool call chain that is produced.
- **debug-chat-simple.js** – Sends a single message to the agent and prints the assistant's reply. Useful for quickly verifying that the chat pipeline works.
- **debug-chat-error.js** – Demonstrates basic error handling by intentionally calling the agent incorrectly and logging the resulting error.
- **direct-normalize-test.js** – Directly executes the `normalize_search_results` executor with mock data so you can view the produced design elements.

Run any of these scripts with `node <script-name>` once environment variables such as `OPENAI_API_KEY` are configured. They are intended only for local debugging and are not used in production.
