// Demonstrates 5 independent MCP clients (5 separate AI players, each with its
// own API key) joining ONE campaign and playing D&D together under our hosted
// agentic DM. Run against a dev server: `MCP_URL=http://localhost:3001/api/mcp npx tsx scripts/mcp-party-demo.mts`
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const ENDPOINT = process.env.MCP_URL ?? "http://localhost:3001/api/mcp";

type Res = { content?: { type: string; text?: string }[]; isError?: boolean };
const textOf = (r: Res) => (r.content ?? []).filter((c) => c.type === "text").map((c) => c.text).join("\n");

function makeClient(headers?: Record<string, string>) {
  const client = new Client({ name: "party-demo", version: "1.0.0" });
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

// 5 different "AI players", each a distinct persona from a distinct client.
const PARTY = [
  { handle: "Grukk-AI", name: "Grukk", race: "Half-Orc", className: "Barbarian", persona: "A reckless brawler who charges first.", action: "I kick down the tavern door and roar a challenge." },
  { handle: "Sable-AI", name: "Sable", race: "Elf", className: "Rogue", persona: "A sly cutpurse who scouts the shadows.", action: "I slip into the shadows and pick the lock on the cellar." },
  { handle: "Pyx-AI", name: "Pyx", race: "Gnome", className: "Wizard", persona: "A curious arcane tinkerer.", action: "I cast detect magic to scan the room for enchantments." },
  { handle: "Bramble-AI", name: "Bramble", race: "Halfling", className: "Cleric", persona: "A kind healer who protects the party.", action: "I bless the party before we press onward." },
  { handle: "Torvald-AI", name: "Torvald", race: "Dwarf", className: "Fighter", persona: "A stalwart shield who guards the front line.", action: "I raise my shield and guard the doorway." },
];

async function main() {
  console.log(`Endpoint: ${ENDPOINT}\n`);
  const suffix = Math.random().toString(36).slice(2, 6);

  // Each player is a SEPARATE MCP client connection with its OWN API key.
  const players: { client: Client; transport: StreamableHTTPClientTransport; key: string; playerId: string; agentId: string; def: (typeof PARTY)[number] }[] = [];

  for (const def of PARTY) {
    const boot = makeClient();
    await boot.client.connect(boot.transport);
    const { player, apiKey } = await call(boot.client, "redeem_invite", { code: "DRAGON", handle: `${def.handle}-${suffix}` });
    await boot.transport.close();
    console.log(`✓ ${def.handle}: redeemed invite → own API key ${apiKey.slice(0, 10)}…`);

    const c = makeClient({ Authorization: `Bearer ${apiKey}` });
    await c.client.connect(c.transport);
    const agent = await call(c.client, "create_agent", { name: def.name, race: def.race, className: def.className, persona: def.persona });
    players.push({ ...c, key: apiKey, playerId: player.id, agentId: agent.id, def });
    console.log(`  └ created ${def.name} the ${def.race} ${def.className} (agent ${agent.id.slice(0, 8)}…)`);
  }

  // Player 0 hosts the campaign; everyone else joins the SAME campaign.
  const host = players[0];
  const camp = await call(host.client, "create_campaign", {
    name: `The Five-Client Delve ${suffix}`,
    storyPrompt: "Five strangers meet in a doomed village and must survive the night together.",
    strictness: 20,
  });
  const campaignId = camp.id;
  console.log(`\n✓ ${host.def.handle} created campaign "${camp.name}" (${campaignId})`);

  for (const p of players) {
    const r = await call(p.client, "join_campaign", { campaignId, agentId: p.agentId });
    console.log(`✓ ${p.def.handle} joined the party${r.alreadyJoined ? " (already in)" : ""}`);
  }

  await call(host.client, "start_campaign", { campaignId });
  console.log(`\n✓ Campaign started by the host. The hosted DM writes the opening scene.\n`);

  // Each AI independently reads shared state, then acts in character.
  for (const p of players) {
    const state = await call(p.client, "get_campaign_state", { campaignId, logLimit: 3 });
    console.log(`— ${p.def.name} sees turn ${state.campaign.turnCount}, party of ${state.party.length}; acts →`);
    await call(p.client, "take_action", { campaignId, agentId: p.agentId, actionText: p.def.action });
  }

  // Final shared view from one client shows ALL five AIs acted in ONE log.
  const final = await call(host.client, "get_campaign_state", { campaignId, logLimit: 40 });
  console.log(`\n===== SHARED ADVENTURE LOG (campaign ${campaignId}) =====`);
  for (const m of final.log as { authorName: string; type: string; content: string }[]) {
    console.log(`[${m.type}] ${m.authorName}: ${m.content.slice(0, 140)}`);
  }
  console.log(`\nParty (all 5 in one campaign, from 5 separate clients/keys):`);
  for (const a of final.party as { name: string; className: string; owner: string; hp: number; maxHp: number; level: number }[]) {
    console.log(`  • ${a.name} the ${a.className} — owner @${a.owner} — HP ${a.hp}/${a.maxHp}, L${a.level}`);
  }
  console.log(`\nTotal turns taken: ${final.campaign.turnCount}`);

  for (const p of players) await p.transport.close();
  console.log(`\n✅ 5 independent AI clients played one D&D session together under our hosted DM.`);
}

main().catch((e) => { console.error("DEMO FAILED:", e); process.exit(1); });
