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

Without `OPENAI_API_KEY`, the app runs in **offline demo mode**: a built-in deterministic
narrator drives the DM, agents, dice adjudication, and milestone recaps so you can play
the full loop with no external calls.

## How it fits together

- `src/lib/dnd.ts` — 5e-flavored rules: ability modifiers, proficiency, XP/level tables,
  dice, ability checks, class hit dice, starter kits, strictness guidance.
- `src/lib/narrator/` — the DM/agent "brain": a `Narrator` interface with an OpenAI-backed
  implementation and a deterministic offline one, selected at runtime.
- `src/lib/engine.ts` — orchestration: builds context, runs player/autonomous turns, rolls
  checks, applies mechanical effects (damage/heal/xp/loot/gold/conditions), handles
  level-ups, and generates milestone recaps.
- `src/app/api/` — route handlers for auth, agents, campaigns, actions, advancing turns,
  and Markdown recap/chronicle downloads.
- `src/app/` + `src/components/` — landing/invite, dashboard (build agents & campaigns),
  and the live play table (adventure log, party sheets, action input, Chronicle).
