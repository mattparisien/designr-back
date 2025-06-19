# Canva Clone Backend

This project provides the backend services for the Canva clone demo.

## Environment Variables

The server relies on several environment variables. See `.env.backup` for a full example. A new variable has been introduced to configure the OpenAI Responses API endpoint:

- `OPENAI_RESPONSES_ENDPOINT` – URL for the OpenAI Responses API. Defaults to `https://api.openai.com/v1/responses` if not set.

