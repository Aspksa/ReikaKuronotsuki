# v85–v98 — Reika AI dialogue (optional local server)

This release provides **an actual optional LLM connection**, not an AI model embedded in the repository. The offline rule-based chat remains the default.

## Start locally

1. Install Node.js 22 or newer.
2. Set `OPENAI_API_KEY` in your **server environment**, never in HTML, browser localStorage, or GitHub commits.
3. Optionally set `REIKA_AI_MODEL` (default: `gpt-4.1-mini`).
4. Run `node server/reika-ai.js`; visit `http://127.0.0.1:8787`.
5. Select **AI через локальный сервер** in the chat. Static opening of `prototype/index.html` will use offline fallback, because there is no proxy.

## Security and scope

The Node server binds to loopback only, serves the prototype from a fixed directory, forbids unrecognized paths, and supplies a same-origin `POST /api/chat` endpoint. The API key exists only in the Node process. Incoming context is limited to 20 messages (500 characters each), total request length is capped, and provider requests time out after 20 seconds. No conversation is stored by the proxy. In AI mode, the **last up to 20 messages are sent to the external API provider**. Disable AI mode to keep replies offline. Imported/downloaded conversation JSON remains user-managed.

Milestones: **v85** proxy scaffold, **v86** key isolation, **v87** bounded context, **v88** input validation, **v89** role mapping, **v90** system persona, **v91** optional AI mode, **v92** offline fallback, **v93** fetch timeout, **v94** provider error handling, **v95** limited response, **v96** message-history integration, **v97** browser tests, and **v98** Node regression tests.

This is a local prototype, not an internet-facing production service: add authentication, rate limiting, HTTPS, structured logs, spending controls and abuse protections before exposing it publicly. No cloud-based persistent memory, speech recognition or Live2D rig is included.
