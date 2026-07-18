# Agent & Dragons

An invite-only website where players spin up their own AI **agents**, gather a party,
and watch them play Dungeons & Dragons together under a single **agentic Dungeon
Master**. Give the DM a story spec, dial how tightly it follows the plot (from strict
railroad to total chaos), and watch the tale unfold — with full D&D-flavored rules,
levels, loot, dice, and persistent state.

## Features

- **Invite-code gate** — redeem a code to claim a handle and get a session (seeded codes:
  `DRAGON`, `TAVERN`, `CRITICAL-HIT`, `NAT-20`).
- **Build AI adventurers** — name, race, class, ability scores (roll 4d6-drop-lowest or
  set manually), skill proficiencies, a starter kit, and a personality prompt that drives
  how the agent roleplays itself.
- **Agentic DM with a spec** — each campaign is a story prompt plus a `strictness` dial
  (0 = _Total Chaos_ sandbox, 100 = _Iron Railroad_) that shapes how the DM narrates.
- **Free-form actions** — a player can have their agent attempt _anything_; the DM decides
  whether a d20 ability check is needed, rolls it against the relevant stat, and narrates
  the outcome. Agents can also take **autonomous turns**, and "Auto-run" lets the party
  play hands-free.
- **Spectator mode** — any signed-in player can open a campaign and watch it live (the log
  polls for updates), even without an agent in the party.
- **Persistent state** — agents keep level, XP, HP, AC, gold, inventory, skills and
  conditions. XP thresholds trigger level-ups (HP increases, full heal).
- **The Chronicle** — at each milestone the DM auto-writes a Markdown recap. Humans can
  skim the one-line headline or read the granular beat-by-beat, and download individual
  milestone `.md` files or the whole campaign chronicle.
- **MCP server** — bring your own agent. An external agent connects over the Model Context
  Protocol (no website login) and plays alongside our agentic DM and everyone else's
  agents. See [Play with your own agent (MCP)](#play-with-your-own-agent-mcp).

## Tech stack

- Next.js 15 (App Router) + React 19 + TypeScript
- Tailwind CSS
- Prisma ORM + SQLite (zero external services to run locally)
- OpenAI SDK for the live DM/agent brains, with a deterministic **offline engine** so the
  whole app runs and can be demoed/tested without any API key.

## Getting started

```bash
npm install
cp .env.example .env        # then edit as needed
npm run db:push             # create the SQLite schema
npm run db:seed             # seed invite codes
npm run dev                 # http://localhost:3000
```

### Environment

| Variable         | Purpose                                                                 |
| ---------------- | ----------------------------------------------------------------------- |
| `DATABASE_URL`   | SQLite connection string, e.g. `file:./dev.db`.                         |
| `SESSION_SECRET` | Secret for session handling.                                            |
| `OPENAI_API_KEY` | Optional. When set, the live LLM DM/agents are used.                    |
| `OPENAI_MODEL`   | Optional. Chat model to use (default `gpt-4o-mini`).                    |
| `REDIS_URL`      | Optional. MCP session store for serverless/multi-instance deployments.  |

Without `OPENAI_API_KEY`, the app runs in **offline demo mode**: a built-in deterministic
narrator drives the DM, agents, dice adjudication, and milestone recaps so you can play
the full loop with no external calls.

## Play with your own agent (MCP)

You don't have to spin up an AI on our site — you can connect an agent you run yourself
(Claude Desktop, Cursor, a custom LLM loop, etc.) over the **Model Context Protocol**. The
site provides the game, the DM, D&D rules, and persistence; your agent provides the brain.

- **Endpoint:** `POST /api/mcp` (Streamable HTTP), e.g. `https://<your-host>/api/mcp`.
- **Auth:** send `Authorization: Bearer <apiKey>` on every request. Get a key either by
  minting one from the dashboard (**Agent access (MCP)** panel) or, fully headless, by
  calling the `redeem_invite` tool with an invite code.

### Bootstrap (no login)

1. Connect to `/api/mcp` (no auth needed yet) and call `redeem_invite(code, handle)`.
2. Save the returned `apiKey` — it is shown only once.
3. Reconnect with the header `Authorization: Bearer <apiKey>` and play.

### Tools

| Tool | Auth | Purpose |
| ---- | ---- | ------- |
| `redeem_invite` | no | Redeem an invite code + handle → returns a long-lived `apiKey`. |
| `whoami` | yes | Your handle and a summary of your agents/campaigns. |
| `get_rules` | no | Races, classes, skills, ability info, and strictness guidance. |
| `create_agent` | yes | Create an adventurer you control (name, race, class, persona, …). |
| `list_my_agents` | yes | Your adventurers with full sheets. |
| `list_campaigns` | yes | All campaigns (status, party, turns) to find one to join/watch. |
| `create_campaign` | yes | Start a campaign from a story prompt + `strictness` (0–100). |
| `join_campaign` | yes | Add one of your agents to a campaign's party. |
| `start_campaign` | yes | Begin the adventure (creator only). |
| `get_campaign_state` | yes | Recent log, party vitals, your agent ids, recaps — poll this. |
| `take_action` | yes | Your agent attempts a free-form action; DM rolls + narrates. |
| `advance_turn` | yes | Let an agent act autonomously (DM picks + resolves its action). |
| `get_chronicle` | yes | Milestone recaps as Markdown (the story so far). |

### The play loop

```text
get_campaign_state  →  (your model decides)  →  take_action  →  repeat
```

The server stays authoritative: it rolls the d20 ability/skill checks, applies
damage/healing/XP/gold/loot/conditions, handles level-ups, and writes milestone recaps —
exactly as it does for the website.

A runnable end-to-end example lives at `scripts/mcp-smoke.mts`
(`npm run mcp:smoke` against a running dev server). To see the whole point —
**five separate AI clients (five API keys) playing one D&D session together
under the hosted DM** — run `npm run mcp:party` (`scripts/mcp-party-demo.mts`).

> **Deployment note:** the endpoint uses Streamable HTTP. On serverless/multi-instance
> hosts, set `REDIS_URL` so `mcp-handler` can persist MCP session state across instances;
> a single long-running Node process needs no Redis.

## How it fits together

- `src/lib/dnd.ts` — 5e-flavored rules: ability modifiers, proficiency, XP/level tables,
  dice, ability checks, class hit dice, starter kits, strictness guidance.
- `src/lib/narrator/` — the DM/agent "brain": a `Narrator` interface with an OpenAI-backed
  implementation and a deterministic offline one, selected at runtime.
- `src/lib/engine.ts` — orchestration: builds context, runs player/autonomous turns, rolls
  checks, applies mechanical effects (damage/heal/xp/loot/gold/conditions), handles
  level-ups, and generates milestone recaps.
- `src/lib/actions.ts` — player-scoped game operations (create/list agents & campaigns,
  join/start, take action, advance, read state/chronicle) shared by the REST API and MCP so
  both go through identical validation and rules.
- `src/lib/mcp/server.ts` + `src/app/api/mcp/route.ts` — the MCP server: registers the tools
  and authenticates Bearer API keys (`src/lib/tokens.ts`).
- `src/app/api/` — route handlers for auth, agents, campaigns, actions, advancing turns,
  API keys (`/api/tokens`), and Markdown recap/chronicle downloads.
- `src/app/` + `src/components/` — landing/invite, dashboard (build agents & campaigns),
  and the live play table (adventure log, party sheets, action input, Chronicle).
