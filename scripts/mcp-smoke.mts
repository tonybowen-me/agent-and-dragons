import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const ENDPOINT = process.env.MCP_URL ?? "http://localhost:3000/api/mcp";

function connect(headers?: Record<string, string>) {
  const client = new Client({ name: "smoke", version: "1.0.0" });
  const transport = new StreamableHTTPClientTransport(new URL(ENDPOINT), {
    requestInit: headers ? { headers } : undefined,
  });
  return { client, transport };
}

function textOf(res: any): string {
  return (res.content ?? [])
    .filter((c: any) => c.type === "text")
    .map((c: any) => c.text)
    .join("\n");
}

async function call(client: Client, name: string, args: Record<string, unknown> = {}) {
  const res: any = await client.callTool({ name, arguments: args });
  const text = textOf(res);
  console.log(`\n=== ${name}${res.isError ? " (ERROR)" : ""} ===\n${text.slice(0, 900)}`);
  return { res, text };
}

async function main() {
  // 1. Unauthenticated connection can list tools + bootstrap.
  const a = connect();
  await a.client.connect(a.transport);
  const tools = await a.client.listTools();
  console.log("tools:", tools.tools.map((t) => t.name).join(", "));

  const handle = "mcp-hero-" + Math.random().toString(36).slice(2, 7);
  const { res: redeemRes, text: redeemText } = await call(a.client, "redeem_invite", {
    code: "DRAGON",
    handle,
  });
  if (redeemRes.isError) throw new Error("redeem failed: " + redeemText);
  const apiKey = JSON.parse(redeemText).apiKey as string;
  console.log("got apiKey:", apiKey.slice(0, 12) + "…");

  // 2. Unauthenticated whoami should be rejected.
  const w = await call(a.client, "whoami");
  if (!w.res.isError) throw new Error("whoami should require auth");
  await a.transport.close();

  // 3. Bad token rejected.
  const bad = connect({ Authorization: "Bearer not-a-real-token" });
  await bad.client.connect(bad.transport);
  const badWho = await call(bad.client, "whoami");
  if (!badWho.res.isError) throw new Error("bad token should be rejected");
  await bad.transport.close();

  // 4. Authenticated flow.
  const s = connect({ Authorization: `Bearer ${apiKey}` });
  await s.client.connect(s.transport);

  await call(s.client, "whoami");
  await call(s.client, "get_rules");
  const agent = await call(s.client, "create_agent", {
    name: "Grukk",
    race: "Half-Orc",
    className: "Barbarian",
    persona: "A loud, reckless brawler who solves problems with an axe.",
    skills: ["Athletics", "Intimidation"],
  });
  const agentId = JSON.parse(agent.text).id as string;

  const camp = await call(s.client, "create_campaign", {
    name: "The Moon Heist",
    storyPrompt: "The party starts in a tiny village and must find a way to the moon.",
    strictness: 15,
  });
  const campaignId = JSON.parse(camp.text).id as string;

  await call(s.client, "join_campaign", { campaignId, agentId });
  await call(s.client, "start_campaign", { campaignId });
  await call(s.client, "get_campaign_state", { campaignId, logLimit: 5 });
  await call(s.client, "take_action", {
    campaignId,
    agentId,
    actionText: "I climb the tallest tree in the village and shout that we're going to the moon.",
  });
  await call(s.client, "advance_turn", { campaignId, agentId });
  await call(s.client, "get_chronicle", { campaignId });

  await s.transport.close();
  console.log("\nALL MCP SMOKE CHECKS PASSED");
}

main().catch((e) => {
  console.error("SMOKE FAILED:", e);
  process.exit(1);
});
