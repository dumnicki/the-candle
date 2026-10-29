# Ghost in the Candle

Entry for DEV's Hacktoberfest Open-Source AI Challenge, Week 4 ("Ghost in the Machine").
Deadline: Oct 31, 2026, 11:59 PM PDT (Sun Nov 1, 07:59 Europe/Warsaw).

A dark room, one lit candle. The player blows into the mic, the flame goes out, and a ghost speaks. The player picks one of two replies. Each ghost has its own voice, personality, history, and secret. The secret is the twist: it lives only in `ghosts/<id>.json`. Do not copy it into this plan, the README, or a commit message. Reading those JSON files spoils the story.

## Decisions locked for this repo

1. The writer is **Gemma 4**, not Gemma 3.
2. **Backboard** is the default way to call the model. The LLM layer stays swappable with Ollama or any OpenAI-compatible local server (LM Studio, llama.cpp, and the like).
3. Voice stays swappable. ElevenLabs is the default. Piper is the open fallback and is a stub until the candle scene.

## Gemma 4

Gemma 4 is Google DeepMind's open-weight family after Gemma 3. Five sizes. The "E" in E2B and E4B means effective parameters (the embedding tables are larger than the active stack). The "A" in 26B A4B means active parameters: about 3.8B of 25.2B fire per token.

| Size | What it is | Text in | Ollama tag | Ollama download | Context | Where it fits |
|---|---|---|---|---|---|---|
| E2B | 2.3B effective (5.1B with embeddings) | text, image, audio | `gemma4:e2b` | 4.6–7.5 GB | 128K | phones, tight laptops |
| E4B | 4.5B effective (8B with embeddings) | text, image, audio | `gemma4:e4b` | 6.6–9.5 GB | 128K | phones and laptops |
| 12B Unified | ~12B dense, encoder-free | text, image, audio | `gemma4:12b` | 7.7–8.0 GB | 256K | laptops, desktops, small servers |
| 26B A4B | MoE, ~3.8B active | text, image | `gemma4:26b` | 16–19 GB | 256K | desktops, small servers |
| 31B | dense | text, image | `gemma4:31b` | 19–20 GB | 256K | large servers |

`gemma4` and `gemma4:latest` are aliases of `gemma4:e4b`. Apple Silicon builds use the `-mlx` tags (`gemma4:e4b-mlx` and the rest). `gemma4:cloud` and `gemma4:31b-cloud` are Ollama's hosted copies, not local weights.

Pull the laptop tag:

```
ollama pull gemma4:e4b
```

**Laptop default: `gemma4:e4b`.** Google and Ollama both place E4B on laptops, the quantized file fits a 16 GB machine, and it is the tag you get from `ollama pull gemma4`. Step up to `gemma4:12b` when the machine has a GPU (similar disk, more compute, 256K context). Drop to `gemma4:e2b` when RAM is tight. Leave `gemma4:26b` and `gemma4:31b` for a workstation.

Gemma 4 thinks only when the system text starts with `<|think|>`. This game wants a JSON object, so prompts must not send that token. Larger sizes may still emit an empty `<|channel>thought … <channel|>` block; the parser strips it. Ollama's own sampling note for this family is temperature 1.0, top_p 0.95, top_k 64. The Ollama provider sends those. Native `system` role is supported, unlike early Gemma 3 chat templates.

Sources:

- [Gemma 4 overview](https://ai.google.dev/gemma/docs/core) (sizes, memory table)
- [Gemma 4 model card](https://ai.google.dev/gemma/docs/core/model_card_4)
- [Which Gemma to pick](https://ai.google.dev/gemma/docs/get_started)
- [Run Gemma with Ollama](https://ai.google.dev/gemma/docs/integrations/ollama) (updated 2026-04-02; lists E2B, E4B, 26B, 31B and `ollama pull gemma4`, and does not yet mention `gemma4:12b`)
- [Ollama library: gemma4](https://ollama.com/library/gemma4) (live tags, including `gemma4:12b`, the `latest` = E4B alias, and the MLX tags)

## Backboard

[Backboard](https://docs.backboard.io/) is a hosted API for conversations. One call does the work:

```
POST https://app.backboard.io/api/threads/messages
X-API-Key: <key>
```

Omit `thread_id` and it creates a thread and an assistant. Pass `thread_id` to continue. Pass `assistant_id` to share memory and documents across threads. Memory modes are `Auto`, `Readonly`, and `off` (the default). The model catalog is large (the docs say 17,000+), reached with `llm_provider` and `model_name`.

If you omit both, Backboard calls **OpenAI `gpt-4o`**. That does not meet this challenge.

The `google` provider in the docs is **Gemini** (`gemini-2.5-pro`, `gemini-3.1-pro-preview`), not open-weight Gemma. Do not set `BACKBOARD_LLM_PROVIDER=google`.

### Can Backboard serve Gemma 4?

**Yes, by routing to a host that runs the open weights. Not through the `google` provider.**

Checked on Oct 28, 2026:

- OpenRouter's public model list (`GET https://openrouter.ai/api/v1/models`) currently includes:
  - `google/gemma-4-26b-a4b-it` (262,144 context), plus a `:free` variant
  - `google/gemma-4-31b-it` (262,144 context), plus a `:free` variant
  - It does **not** list Gemma 4 E2B, E4B, or 12B. Those sizes are a local pull (`ollama pull gemma4:e4b`), not a hosted id.
- Backboard documents `openrouter` as an `llm_provider`, and its dashboard lists OpenRouter and Featherless (open-source models) next to OpenAI, Anthropic, Google, and others. `json_output: true` asks for a JSON object. It is ignored when tools, RAG, or web search are on, so this game turns those off.
- `GET https://app.backboard.io/api/models` returned **401** without an API key, so this session could not re-list Backboard's own catalog. A previous authenticated listing on another project by this repo's owner found Gemma on Backboard under `openrouter` (`google/gemma-4-26b-a4b-it`, 262,144 context) and `featherless` (`google/gemma-4-26B-A4B-it`, 32,768 context, different casing). Treat the Featherless id as a lead, not a default, until you confirm it with the curl in `.env.example`.

So the open-weight model can sit at the core while Backboard is the default client. The code always sends `llm_provider` and `model_name`. It does not inherit the gpt-4o default.

**Hosted default:** `BACKBOARD_LLM_PROVIDER=openrouter` and `BACKBOARD_MODEL=google/gemma-4-26b-a4b-it`. Of the two Gemma 4 ids on OpenRouter, the 26B A4B is the one with a few billion active parameters. The laptop does not load the weights. If that id disappears from Backboard, switch to Ollama rather than falling through to a closed model.

Backboard keeps the visit on `thread_id`. The first call omits it and the response returns the new id; the next call sends that id and only the new visitor line. `memory` stays `off`. Ollama and the OpenAI-compatible provider still take the full `history` array, so a client can send both. The ghost's secret is fiction, not a fact to store.

Sources:

- [Backboard introduction](https://docs.backboard.io/)
- [Threads](https://docs.backboard.io/concepts/threads)
- [Send message](https://docs.backboard.io/concepts/messages) (`llm_provider`, `model_name`, `json_output`, `memory`)
- [Memory](https://docs.backboard.io/concepts/memory)
- [Models](https://docs.backboard.io/concepts/models) (unset provider means `openai` / `gpt-4o`)
- [Thinking / Google provider examples](https://docs.backboard.io/concepts/thinking) (Gemini model names)
- [Dashboard provider list](https://docs.backboard.io/dashboard)
- [OpenRouter: Gemma 4 26B A4B](https://openrouter.ai/google/gemma-4-26b-a4b-it)
- [OpenRouter: Gemma 4 31B](https://openrouter.ai/google/gemma-4-31b-it)

## Challenge requirements

- **Open model at the core.** Gemma 4 writes every ghost line and both player options. Default path: Backboard → OpenRouter → `google/gemma-4-26b-a4b-it`. Local path: Ollama `gemma4:e4b`, or the same weights behind an OpenAI-compatible server.
- **Voice.** ElevenLabs by default, behind `TtsProvider`, with Piper as the open fallback. The turn route does not speak yet.
- New project, public repo, and later a demo plus a DEV post on why open matters.

## Stack

| Part | Choice | Why |
|---|---|---|
| LLM, default | Backboard → OpenRouter → Gemma 4 26B A4B | Hosted open weights, threads API ready for later |
| LLM, on a laptop | Ollama `gemma4:e4b` | The E4B tag is the laptop-sized local model |
| LLM, other local | `LLM_PROVIDER=openai` | LM Studio, llama.cpp, or anything else on `/v1/chat/completions` |
| Backend | Node.js + TypeScript, Hono | Small, keys stay on the server |
| Frontend | Vite + vanilla TypeScript, plain CSS | No framework for a short build |
| Voice | ElevenLabs, Piper stub | Expressive by default, open fallback reserved |
| Blow detection | Web Audio `AnalyserNode`, not built yet | No model needed |
| Ghosts | `ghosts/*.json` | One file per ghost |

## Architecture

```
Browser (Vite)
  ├─ Candle scene + mic blow detection   (shell only, this milestone)
  ├─ Ghost line, audio, two buttons      (not yet)
  └─ POST /api/turn  { ghostId, history[], thread_id? }
        │
Node (Hono)
  ├─ loads ghosts/<id>.json
  ├─ LlmProvider ──► Backboard | Ollama | OpenAI-compatible | mock
  ├─ TtsProvider ──► ElevenLabs | Piper stub   (not called by /api/turn yet)
  └─ { ghost_line, options[2], reveal_stage }
```

`mock` returns a canned line so the route runs with no key. It is not the game.

### Interfaces

```ts
interface LlmProvider {
  readonly id: string;
  nextTurn(ghost: Ghost, history: Turn[]): Promise<GhostTurn>;
}

interface TtsProvider {
  readonly id: string;
  speak(text: string, voice: VoiceConfig): Promise<ArrayBuffer>;
}

type Turn = { role: "ghost" | "player"; text: string };
type GhostTurn = { ghost_line: string; options: [string, string]; reveal_stage: number };
```

`id` is only there so logs and `/health` can say which backend is live.

Select with env:

- `LLM_PROVIDER=backboard` (default) `| ollama | openai | mock`
- `TTS_PROVIDER=elevenlabs` (default) `| piper`

See `.env.example` for every variable. `LLM_MODEL` overrides the local model id only. It does not change the Backboard model, because `gemma4:e4b` is not an OpenRouter id.

## Ghost profile

Full profiles, including the secret, are `ghosts/<id>.json`. Eliza is the starter. Public facts only:

- id `eliza`, name Eliza Marrow, died 1891
- polite, tired, formal, a little possessive of the house
- housekeeper who kept a candle in the window for a son lost at sea
- four reveal stages
- voice ids are `TBD` until ElevenLabs and Piper are chosen

The opening line is in that file. The model is told to keep its meaning on the first turn.

## Prompt contract

- Stay in character. One to three short sentences. Eerie, not gory.
- Raise `reveal_stage` by at most one per turn. The secret is allowed only at the final stage.
- `options[0]` is a curious thing the visitor might say. `options[1]` is a cautious one.
- JSON only. Ollama gets `format: "json"`. Backboard gets `json_output: true`. The OpenAI-compatible provider sends `response_format: { type: "json_object" }` and, on HTTP 400, tries once without it (some llama.cpp builds reject the field).
- Validate the object. On failure, retry once with a repair instruction. Then return 502.
- The route accepts `options` as a pair or as `{ "a", "b" }`, and always returns a two-element array.
- Do not put the secret, or any other ghost field, in the HTTP response.

`POST /api/turn`

```json
{ "ghostId": "eliza", "history": [{ "role": "player", "text": "Who are you?" }], "thread_id": "optional" }
```

```json
{ "ghost_line": "...", "options": ["...", "..."], "reveal_stage": 1, "thread_id": "when Backboard returns one" }
```

`history` may be omitted. Roles are `ghost` or `player` only.

## Repo layout

```
/server   Hono app, LlmProvider, TtsProvider (`src/http`, `src/conversation`, `src/ghosts`, `src/llm`, `src/tts`)
/web      Vite app: index.html, src/main.ts, src/candle.ts, src/mic.ts, src/styles.css
/ghosts   eliza.json
.env.example   README.md   PLAN.md
```

## Milestones

1. **Wed:** this plan, the scaffold, and `POST /api/turn` returning validated JSON. **Done in this branch.** Voice is not on the response yet.
2. **Thu:** ElevenLabs audio and a page with two buttons. Full conversation loop.
3. **Fri:** candle scene, mic blow detection, two or three more ghosts, Piper (or Kokoro) actually speaking.
4. **Sat:** endings, polish, demo, README, DEV post. Publish.

## Rules for agents

- Never commit secrets. Keys live in `.env` only.
- Keep LLM and TTS behind the interfaces above. Do not call Backboard, Ollama, or ElevenLabs from the route handlers directly.
- Do not point Backboard at `google` / Gemini or leave the model unset. The core model stays open-weight Gemma 4.
- Do not copy a ghost's `secret` into PLAN.md, README, UI copy, or tests. Tests should load it from `ghosts/*.json` when they need it.
- Small commits. No new framework without a reason.
- `LLM_PROVIDER=mock` is for smoke tests. The demo must not use it.
