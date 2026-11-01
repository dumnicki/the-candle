# Ghost in the Candle

A dark room, a candle, and a ghost that answers in its own voice. This is a [DEV Hacktoberfest Open-Source AI Challenge](https://dev.to/) week 4 project ("Ghost in the Machine"). The plan, including the Gemma 4 and Backboard notes, is [PLAN.md](PLAN.md).

Gemma 4 writes the ghost's line and both replies. [Backboard](https://docs.backboard.io/) is the default client and is pinned to the open-weight model `google/gemma-4-26b-a4b-it` through OpenRouter. Ollama (`gemma4:e4b`) and any local OpenAI-compatible server can take that place. ElevenLabs is the default voice, behind the same kind of swap, with a Piper stub for the open fallback.

The files in `ghosts/` contain each ghost's secret. Reading them spoils the story.

The page is a quiet room with a candle. Blow into the microphone, or hold the left mouse button and bring the cursor close, and the flame goes out. A ghost is chosen at random. You read the line as subtitles, hear it when an ElevenLabs key is set, and pick a reply. The lighter in the corner lights the candle again and cuts the voice off.

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

The room calls `GET /api/ghosts` and `POST /api/turn`. Start the API first, then Vite. Vite proxies `/api` to http://127.0.0.1:8787 .

#### Mock mode

No key. Canned lines, so you can click through the whole visit:

```bash
LLM_PROVIDER=mock npm run dev
```

In another terminal:

```bash
npm run dev:web
```

Open http://127.0.0.1:5173 . Blow out the candle. A ghost is chosen at random. The ghost's line shows as subtitles, and every string in `options` becomes a button. Choosing one appends that turn to `history` and asks for the next line. **Try again** resends the failed request. The lighter lights the candle and ends the visit.

Mock mode does not return `thread_id`. The page still sends one when a provider includes it.

#### Backboard mode

Put `BACKBOARD_API_KEY` in `.env` and leave the Backboard settings from the section above (`LLM_PROVIDER=backboard`). Then, in two terminals:

```bash
npm run dev
```

```bash
npm run dev:web
```

Open http://127.0.0.1:5173 . The first turn starts a Backboard thread. The page keeps `thread_id` from the response and sends it on the next turn, along with `history`. Lighting the candle again drops the thread and begins a new visit.

### Voice

Each ghost's voice lives in its profile, under `voice` in `ghosts/<id>.json`. The browser never sees the id. After a line is on screen it `POST`s `{ "ghostId", "text" }` to `/api/tts`, and the server calls the selected provider. Subtitles do not wait for the audio. Reply buttons show immediately. Picking a reply, or lighting the candle, stops the line that is playing.

With no `ELEVENLABS_API_KEY`, or if ElevenLabs times out or returns an error, the visit continues on subtitles. The server logs a `[tts]` line and does not fail the turn. `TTS_PROVIDER=piper` is still the open fallback, and it is still a stub, so that path is subtitles too.

```bash
# Subtitles only
LLM_PROVIDER=mock npm run dev

# Spoken lines. Put the key in .env, not in the shell history if you can avoid it.
# ELEVENLABS_API_KEY=...
# ELEVENLABS_MODEL_ID=eleven_flash_v2_5
npm run dev
```

Then `npm run dev:web` and open http://127.0.0.1:5173 . Blow out the candle. The first click or the mic prompt is enough for the browser to allow sound; the line itself plays when it comes back, which is after that gesture.

The house has one ghost today:

| Ghost | Voice | `elevenlabs_voice_id` | Why |
|---|---|---|---|
| Eliza Marrow | Florence — Atmospheric Storyteller | `22N9cF8z0o7y23njdyaY` | British, middle-aged, gentle. A default-library voice meant for historical narration. |

Florence is the current default-library replacement for Lily, so it is not one of the older premade ids that expire at the end of 2026. To try another voice, change `elevenlabs_voice_id` in that ghost's JSON and restart the API. A few other default voices, if you add a ghost:

| Voice | Id | Fits |
|---|---|---|
| Talia — Warm Soft Guide | `OZ0L6eISlOejga3XjDFt` | a quieter, softer ghost |
| Eldrin — Crisp British Baritone | `6WwXjDDEMyNmFG95zycZ` | a formal man |
| Sawyer — Midnight Storyteller | `8dEUmyPMdDdK91vboYih` | a darker narrator |

Optional `voice.settings` is passed through as ElevenLabs `voice_settings` when you set it: `stability` and `similarity_boost` and `style` from 0 to 1, `speed` from 0.7 to 1.2, and `use_speaker_boost`. Eliza uses stability `0.42`, similarity `0.8`, and speed `0.92` (a little slower, a little less flat). `style` is for `eleven_multilingual_v2`; Flash ignores it, so her profile leaves it out. A value outside those ranges is ignored. `piper_model` is reserved for the stub (`en_GB-cori-medium` for Eliza, a British Piper voice) and is not spoken yet.

`ELEVENLABS_MODEL_ID` defaults to `eleven_flash_v2_5`. Set `eleven_multilingual_v2` if you would rather wait a little longer for a richer read. `ELEVENLABS_TIMEOUT_MS` defaults to 12000.

### Checks

```bash
npm test
npm run typecheck
npm run build
```

## Request

`GET /api/ghosts` returns `{ "ghosts": [{ "id", "name", "era", "reveal_stages" }] }`, one entry per JSON profile in `ghosts/`. The secret, the opening line, and the backstory are not in this response.

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

`history` may be `[]` or omitted. Optional `thread_id` continues a Backboard thread; the response includes `thread_id` when that provider created or continued one. The response is `{ "ghost_line", "options", "reveal_stage" }`. The model is asked for two options. The page renders however many strings come back.

`POST /api/tts` takes `{ "ghostId", "text" }` and returns `audio/mpeg` for that ghost's voice. `204` means there is nothing to play (no key, Piper stub, timeout, or an ElevenLabs error). The turn response itself stays JSON.

`GET /health` returns `{ "ok": true, "llm": "backboard", "tts": "elevenlabs" }`.

## Layout

- `server/` — Hono API and providers (`http/`, `conversation/`, `ghosts/`, `llm/`, `tts/`)
- `web/` — Vite + TypeScript room (ghost picker, subtitles, reply buttons)
- `ghosts/` — one JSON profile per ghost
- `.env.example` — every variable, no real keys

## License

MIT. See [LICENSE](LICENSE).
