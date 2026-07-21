// FULLY AGENTIC demo: five party members are each their OWN LLM agent (separate
// MCP client + API key) that READS the shared campaign state and DECIDES its own
// in-character action — nothing is scripted. They play under the platform's
// hosted **LLM Dungeon Master** (the server's LlmNarrator, active because the
// dev server runs with OPENAI_API_KEY). Watch real agents playing real D&D.
//
// Run (dev server must have OPENAI_API_KEY too):
//   MCP_URL=http://localhost:3001/api/mcp npx tsx scripts/mcp-agentic-demo.mts
import OpenAI from "openai";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const ENDPOINT = process.env.MCP_URL ?? "http://localhost:3001/api/mcp";
const ROUNDS = Number(process.env.DEMO_ROUNDS ?? 3);
const MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

type Res = { content?: { type: string; text?: string }[]; isError?: boolean };
const textOf = (r: Res) => (r.content ?? []).filter((c) => c.type === "text").map((c) => c.text).join("\n");

function makeClient(headers?: Record<string, string>) {
  const client = new Client({ name: "agentic-demo", version: "1.0.0" });
  const transport = new StreamableHTTPClientTransport(new URL(ENDPOINT), {
    requestInit: headers ? { headers } : undefined,
  });
  return { client, transport };
}
async function call(client: Client, name: string, args: Record<string, unknown> = {}) {
  const res = (await client.callTool({ name, arguments: args })) as Res;
  const text = textOf(res);
  if (res.isError) throw new Error(`${name} failed: ${text}`);
  return text ? JSON.parse(text) : {};
}

type LogMsg = { type: string; author: string | null; content: string; roll?: unknown };

// Each player = a distinct LLM persona. The persona is BOTH the D&D character
// sheet AND the system prompt that steers that agent's reasoning.
const PARTY = [
  { handle: "Grukk", race: "Half-Orc", className: "Barbarian", persona: "Grukk: a hot-headed half-orc barbarian. Impulsive, loyal, solves problems with muscle and intimidation, distrusts magic." },
  { handle: "Sable", race: "Elf", className: "Rogue", persona: "Sable: a calculating elven rogue. Cautious, greedy, prefers stealth, traps and misdirection over open fights." },
  { handle: "Pyx", race: "Gnome", className: "Wizard", persona: "Pyx: an over-curious gnome wizard. Analytical, easily distracted by arcane mysteries, loves clever spell solutions." },
  { handle: "Bramble", race: "Halfling", className: "Cleric", persona: "Bramble: a warm-hearted halfling cleric. Protective, diplomatic, tries to heal and keep the party alive and together." },
  { handle: "Torvald", race: "Dwarf", className: "Fighter", persona: "Torvald: a disciplined dwarf fighter. Tactical, stubborn, holds the line and thinks about positioning and defense." },
];

function renderState(state: any, meName: string): string {
  const party = (state.party as any[])
    .map((p) => `${p.name} (${p.race} ${p.className}) HP ${p.hp}/${p.maxHp} L${p.level}${p.mine ? " [YOU]" : ""} conditions:[${p.conditions.join(",")}]`)
    .join("\n");
  const log = (state.log as LogMsg[])
    .filter((m) => m.type !== "system")
    .slice(-10)
    .map((m) => {
      if (m.type === "roll") return `🎲 ${m.content}`;
      if (m.type === "dm") return `DM: ${m.content}`;
      return `${m.author ?? "?"}: ${m.content}`;
    })
    .join("\n");
  return `CAMPAIGN: ${state.campaign.name} (turn ${state.campaign.turnCount}, strictness ${state.campaign.strictness}=${state.campaign.strictnessLabel})\nSTORY SO FAR:\n${log}\n\nPARTY:\n${party}\n\nYou are ${meName}.`;
}

// The agent's brain: given shared state, decide ONE in-character action.
async function decideAction(persona: string, stateText: string): Promise<string> {
  const res = await openai.chat.completions.create({
    model: MODEL,
    temperature: 1.0,
    max_tokens: 60,
    messages: [
      { role: "system", content: `You are role-playing a Dungeons & Dragons character in a shared campaign with other players and an AI Dungeon Master. ${persona}\n\nDecide your character's NEXT action. Reply with ONE short first-person action or line of dialogue (max 25 words), in character. Build on what just happened and coordinate with your party. No narration of outcomes — only what YOU attempt.` },
      { role: "user", content: `${stateText}\n\nWhat do you do next?` },
    ],
  });
  return (res.choices[0]?.message?.content ?? "I ready my weapon and stay alert.").trim().replace(/^"|"$/g, "");
}

async function main() {
  console.log(`Endpoint: ${ENDPOINT} | DM: hosted LlmNarrator | player brains: ${MODEL} | rounds: ${ROUNDS}\n`);
  const suffix = Math.random().toString(36).slice(2, 6);
  const players: { client: Client; transport: StreamableHTTPClientTransport; agentId: string; def: (typeof PARTY)[number] }[] = [];

  for (const def of PARTY) {
    const boot = makeClient();
    await boot.client.connect(boot.transport);
    const { apiKey } = await call(boot.client, "redeem_invite", { code: "DRAGON", handle: `${def.handle}-${suffix}` });
    await boot.transport.close();
    const c = makeClient({ Authorization: `Bearer ${apiKey}` });
    await c.client.connect(c.transport);
    const agent = await call(c.client, "create_agent", { name: def.handle, race: def.race, className: def.className, persona: def.persona });
    players.push({ ...c, agentId: agent.id, def });
    console.log(`✓ ${def.handle} the ${def.race} ${def.className} — own LLM agent + own API key`);
  }

  const host = players[0];
  const camp = await call(host.client, "create_campaign", {
    name: `The Ember Below ${suffix}`,
    storyPrompt: "A mining village's children have vanished into an old mine that now glows with unnatural embers. The party must investigate, descend, and uncover what stirs below.",
    strictness: 35,
  });
  const campaignId = camp.id as string;
  for (const p of players) await call(p.client, "join_campaign", { campaignId, agentId: p.agentId });
  await call(host.client, "start_campaign", { campaignId });
  console.log(`\n✓ Campaign "${camp.name}" started. Hosted LLM DM is narrating.\nCampaign id: ${campaignId}\n`);

  const opening = await call(host.client, "get_campaign_state", { campaignId, logLimit: 5 });
  const dmOpen = (opening.log as LogMsg[]).filter((m) => m.type === "dm").slice(-1)[0];
  if (dmOpen) console.log(`🎲 DM (opening scene):\n${dmOpen.content}\n`);

  for (let round = 1; round <= ROUNDS; round++) {
    console.log(`\n========== ROUND ${round} ==========`);
    for (const p of players) {
      const state = await call(p.client, "get_campaign_state", { campaignId, logLimit: 12 });
      const action = await decideAction(p.def.persona, renderState(state, p.def.handle));
      console.log(`\n🤖 ${p.def.handle} decides: "${action}"`);
      const after = await call(p.client, "take_action", { campaignId, agentId: p.agentId, actionText: action });
      const fresh = (after.log as LogMsg[]) ?? [];
      const roll = fresh.filter((m) => m.type === "roll" && m.content.includes(p.def.handle)).slice(-1)[0];
      const dm = fresh.filter((m) => m.type === "dm").slice(-1)[0];
      if (roll) console.log(`   🎲 ${roll.content}`);
      if (dm) console.log(`   DM: ${dm.content}`);
    }
  }

  const final = await call(host.client, "get_campaign_state", { campaignId, logLimit: 100 });
  console.log(`\n\n================= FINAL PARTY =================`);
  for (const a of final.party as any[]) console.log(`  • ${a.name} the ${a.className} — HP ${a.hp}/${a.maxHp}, L${a.level}, XP ${a.xp}, gold ${a.gold}`);
  console.log(`Turns: ${final.campaign.turnCount} | Milestones: ${(final.recaps as any[]).length}`);
  const chron = await call(host.client, "get_chronicle", { campaignId });
  for (const r of chron.recaps as any[]) console.log(`\n📖 ${r.title}: ${r.headline}`);

  for (const p of players) await p.transport.close();
  console.log(`\n✅ Five LLM agents played a real D&D session under the hosted LLM DM.`);
  console.log(`Watch it in the browser: ${ENDPOINT.replace("/api/mcp", "")}/play/${campaignId}`);
}

main().catch((e) => { console.error("DEMO FAILED:", e); process.exit(1); });
