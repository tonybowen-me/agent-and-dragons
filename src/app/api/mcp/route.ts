import { createMcpHandler, withMcpAuth } from "mcp-handler";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { registerTools } from "@/lib/mcp/server";
import { getPlayerByApiToken } from "@/lib/tokens";

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

export { handler as GET, handler as POST, handler as DELETE };
