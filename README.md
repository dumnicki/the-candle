# Ghost in the Candle

A dark room, a candle, and a ghost that answers in its own voice. This is a [DEV Hacktoberfest Open-Source AI Challenge](https://dev.to/) week 4 project ("Ghost in the Machine"). The plan, including the Gemma 4 and Backboard notes, is [PLAN.md](PLAN.md).

Gemma 4 writes the ghost's line and both replies. [Backboard](https://docs.backboard.io/) is the default client and is pinned to the open-weight model `google/gemma-4-26b-a4b-it` through OpenRouter. Ollama (`gemma4:e4b`) and any local OpenAI-compatible server can take that place. ElevenLabs is the default voice, behind the same kind of swap, with a Piper stub for the open fallback.

The files in `ghosts/` contain each ghost's secret. Reading them spoils the story.

Milestone 1 is the turn API. The page is a quiet room with a candle. It does not listen to the mic yet, and `POST /api/turn` does not return audio yet.

## Try it locally

Requires Node.js 20.12 or newer (22 is what this was built with).

```bash
npm install
cp .env.example .env
```

### No API key

Canned replies, so you can see the shape:

```bash
LLM_PROVIDER=mock npm run dev
```

In another terminal:

```bash
curl -s http://127.0.0.1:8787/api/turn \
  -H 'content-type: application/json' \
  -d '{"ghostId":"eliza","history":[]}'
```

The dev server loads `.env` itself. A variable already set in the shell wins over the file, which is why `LLM_PROVIDER=mock` above overrides the default.

### Backboard and Gemma 4 (default)

Put your key in `.env` as `BACKBOARD_API_KEY`. Leave these as they are unless you have confirmed another open-weight Gemma 4 id in the catalog:

```
LLM_PROVIDER=backboard
BACKBOARD_LLM_PROVIDER=openrouter
BACKBOARD_MODEL=google/gemma-4-26b-a4b-it
```

Backboard's `google` provider is Gemini, not Gemma. If you clear the provider, Backboard calls GPT-4o. This app always sends the model fields so that does not happen.

Confirm the id is still listed (the catalog requires the key):

```bash
curl -s "https://app.backboard.io/api/models?provider=openrouter&limit=500" \
  -H "X-API-Key: $BACKBOARD_API_KEY" \
  | jq -r '.models[] | select(.name | test("gemma-4"; "i")) | "\(.provider)\t\(.name)\t\(.context_limit)"'
```

Then:

```bash
npm run dev
```

`POST /api/turn` calls the provider. The first Backboard reply includes `thread_id`. Send that id on the next turn so Backboard keeps the chat. Ollama and the OpenAI-compatible provider ignore it and still use `history`.

### Ollama on a laptop

[Install Ollama](https://ollama.com/download), then pull the E4B tag. `gemma4` and `gemma4:latest` are the same model. The download is about 6.6–9.5 GB.

```bash
ollama pull gemma4:e4b
```

In `.env`:

```
LLM_PROVIDER=ollama
OLLAMA_URL=http://127.0.0.1:11434
OLLAMA_MODEL=gemma4:e4b
```

`gemma4:12b` is the next step up if the laptop has a GPU. `gemma4:e2b` is the smaller one. `gemma4:26b` and `gemma4:31b` are too heavy for a typical laptop.

```bash
npm run dev
```

Then `POST /api/turn` as in the request section below.

### LM Studio, llama.cpp, or another local server

Anything that serves `POST /v1/chat/completions`. LM Studio's default port is 1234. llama.cpp's server is often 8080. Point the base URL at the `/v1` prefix.

```
LLM_PROVIDER=openai
OPENAI_BASE_URL=http://127.0.0.1:1234/v1
OPENAI_MODEL=gemma4
OPENAI_API_KEY=
```

```bash
npm run dev
```

`OPENAI_API_KEY` is optional. When it is empty, the request has no `Authorization` header.

### The page

```bash
npm run dev:web
```

Open http://127.0.0.1:5173 . Vite proxies `/api` to http://127.0.0.1:8787 . The room is visual only for now.

### Checks

```bash
npm test
npm run typecheck
npm run build
```

## Request

`POST /api/turn`

```json
{
  "ghostId": "eliza",
  "history": [
    { "role": "ghost", "text": "Ah... you blew it out." },
    { "role": "player", "text": "Who are you?" }
  ]
}
```

`history` may be `[]` or omitted. Optional `thread_id` continues a Backboard thread; the response includes `thread_id` when that provider created or continued one. The response is `{ "ghost_line", "options": [curious, cautious], "reveal_stage" }`.

`GET /health` returns `{ "ok": true, "llm": "backboard" }`.

## Layout

- `server/` — Hono API and providers (`http/`, `conversation/`, `ghosts/`, `llm/`, `tts/`)
- `web/` — Vite + TypeScript room
- `ghosts/` — one JSON profile per ghost
- `.env.example` — every variable, no real keys

## License

MIT. See [LICENSE](LICENSE).
