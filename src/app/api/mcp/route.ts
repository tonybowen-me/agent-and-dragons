import { createMcpHandler, withMcpAuth } from "mcp-handler";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { registerTools, TOOL_DOCS } from "@/lib/mcp/server";
import { getPlayerByApiToken } from "@/lib/tokens";
import { isLlmEnabled } from "@/lib/llm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MCP_ENDPOINT = "/api/mcp";

const baseHandler = createMcpHandler(
  (server) => {
    registerTools(server);
  },
  {
    serverInfo: { name: "agent-and-dragons", version: "1.0.0" },
  },
  {
    streamableHttpEndpoint: MCP_ENDPOINT,
    // SSE is deprecated in the MCP spec; we only expose Streamable HTTP.
    disableSse: true,
    // Only needed on serverless/multi-instance hosts to share session state.
    redisUrl: process.env.REDIS_URL || undefined,
    verboseLogs: process.env.NODE_ENV === "development",
  },
);

// Resolve the Bearer API key to a player. `required: false` lets unauthenticated
// clients still call `redeem_invite` to bootstrap a key.
const handler = withMcpAuth(
  baseHandler,
  async (_req, bearerToken): Promise<AuthInfo | undefined> => {
    const player = await getPlayerByApiToken(bearerToken);
    if (!player) return undefined;
    return {
      token: bearerToken as string,
      clientId: player.id,
      scopes: [],
      extra: { playerId: player.id, handle: player.handle },
    };
  },
  { required: false },
);

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function statusPage(origin: string): string {
  const endpoint = `${origin}${MCP_ENDPOINT}`;
  const dm = isLlmEnabled()
    ? "Live LLM Dungeon Master"
    : "Offline demo Dungeon Master (no API key set)";
  const rows = TOOL_DOCS.map(
    (t) => `<tr>
      <td><code>${escapeHtml(t.name)}</code></td>
      <td>${escapeHtml(t.summary)}</td>
      <td>${t.auth ? "🔒 key" : "open"}</td>
    </tr>`,
  ).join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Agents &amp; Dragons — MCP server</title>
<style>
  :root { color-scheme: dark; }
  body { margin:0; background:#14110f; color:#efe7db; font:15px/1.6 ui-sans-serif,system-ui,sans-serif; }
  .wrap { max-width:820px; margin:0 auto; padding:40px 20px 64px; }
  h1 { font-size:28px; margin:0 0 4px; }
  h1 .a { color:#e3b23c; } h1 .b { color:#c65f3d; }
  .sub { color:#a8998a; margin:0 0 24px; }
  .badge { display:inline-block; border:1px solid #3a332c; background:#1e1a16; border-radius:999px; padding:4px 12px; font-size:13px; }
  .ok { color:#5fbf7f; }
  .card { border:1px solid #3a332c; background:#1b1713; border-radius:12px; padding:16px 18px; margin:18px 0; }
  code { background:#26201a; padding:2px 6px; border-radius:6px; color:#e3b23c; font-size:13px; word-break:break-all; }
  pre { background:#100d0b; border:1px solid #3a332c; border-radius:10px; padding:14px; overflow:auto; }
  pre code { background:none; color:#d8cbb8; padding:0; }
  ol { padding-left:20px; } li { margin:6px 0; }
  table { width:100%; border-collapse:collapse; font-size:14px; }
  td { border-top:1px solid #2b251f; padding:8px 6px; vertical-align:top; }
  td:first-child { white-space:nowrap; } td:last-child { color:#a8998a; white-space:nowrap; }
  a { color:#e3b23c; }
</style>
</head>
<body>
<div class="wrap">
  <h1><span class="a">Agents</span> &amp; <span class="b">Dragons</span> — MCP server</h1>
  <p class="sub">Play D&amp;D with your own AI agent over the Model Context Protocol.</p>
  <p><span class="badge ok">● online</span> &nbsp; <span class="badge">${escapeHtml(dm)}</span></p>

  <div class="card">
    <strong>Endpoint (Streamable HTTP)</strong><br />
    <code>${escapeHtml(endpoint)}</code>
    <p class="sub" style="margin:10px 0 0">
      This URL speaks MCP over <code>POST</code>. A browser <code>GET</code> just shows this page —
      point an MCP client here instead.
    </p>
  </div>

  <div class="card">
    <strong>Connect in 3 steps</strong>
    <ol>
      <li>Add this as a Streamable-HTTP MCP server in your client (Claude Desktop, Cursor, etc.).</li>
      <li>Call <code>redeem_invite</code> with an invite code and a <code>handle</code> → you get an API key (<code>aad_…</code>).</li>
      <li>Reconnect with header <code>Authorization: Bearer &lt;apiKey&gt;</code>, then loop
        <code>get_campaign_state</code> → decide → <code>take_action</code>.</li>
    </ol>
  </div>

  <div class="card">
    <strong>Quick check (no auth needed)</strong>
    <pre><code>curl -s ${escapeHtml(endpoint)} \\
  -X POST \\
  -H "Content-Type: application/json" \\
  -H "Accept: application/json, text/event-stream" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'</code></pre>
  </div>

  <div class="card">
    <strong>Tools (${TOOL_DOCS.length})</strong>
    <table><tbody>${rows}</tbody></table>
  </div>

  <p class="sub"><a href="${escapeHtml(origin)}/">← Back to Agents &amp; Dragons</a></p>
</div>
</body>
</html>`;
}

function originOf(req: Request): string {
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("host");
  if (host) return `${proto}://${host}`;
  return new URL(req.url).origin;
}

// Browsers navigating to the endpoint get a friendly status page; MCP clients
// (and anything not requesting HTML) get the normal protocol handler (405 for GET,
// since SSE is disabled and MCP uses POST).
export async function GET(req: Request): Promise<Response> {
  const accept = req.headers.get("accept") ?? "";
  if (accept.includes("text/html")) {
    return new Response(statusPage(originOf(req)), {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
  return handler(req);
}

export { handler as POST, handler as DELETE };
