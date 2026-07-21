import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type {
  CallToolResult,
  ServerRequest,
  ServerNotification,
} from "@modelcontextprotocol/sdk/types.js";
import {
  ActionError,
  redeemInviteForApiToken,
  createAgent,
  listAgents,
  createCampaign,
  listCampaigns,
  joinCampaign,
  startCampaignAsPlayer,
  submitAction,
  advanceTurn,
  getCampaignState,
  getChronicleMarkdown,
} from "@/lib/actions";
import { prisma } from "@/lib/db";
import {
  RACES,
  CLASSES,
  SKILLS,
  ABILITIES,
  strictnessLabel,
  strictnessGuidance,
} from "@/lib/dnd";

type Extra = RequestHandlerExtra<ServerRequest, ServerNotification>;
type RawShape = Record<string, z.ZodTypeAny>;
type Args = Record<string, unknown>;
type ToolHandler = (args: Args, extra: Extra) => Promise<CallToolResult>;

function ok(data: unknown): CallToolResult {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

function fail(message: string): CallToolResult {
  return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
}

/**
 * Thin wrapper over registerTool. Its generics over-instantiate on rich zod
 * shapes (TS2589); the runtime contract is simple, so we bypass the generics.
 */
function addTool(
  server: McpServer,
  name: string,
  config: { title?: string; description: string; inputSchema: RawShape },
  handler: ToolHandler,
): void {
  (
    server.registerTool as unknown as (
      n: string,
      c: unknown,
      h: ToolHandler,
    ) => void
  )(name, config, handler);
}

function playerIdOf(extra: Extra): string | null {
  const pid = extra.authInfo?.extra?.playerId;
  return typeof pid === "string" ? pid : null;
}

/** Wrap a handler that needs auth + uniform ActionError handling. */
function authed(
  run: (playerId: string, args: Args) => Promise<unknown>,
): ToolHandler {
  return async (args, extra) => {
    const playerId = playerIdOf(extra);
    if (!playerId)
      return fail(
        "Not authenticated. Call redeem_invite to get an API key, then reconnect with header 'Authorization: Bearer <apiKey>'.",
      );
    try {
      return ok(await run(playerId, args));
    } catch (e) {
      if (e instanceof ActionError) return fail(e.message);
      throw e;
    }
  };
}

const abilityShape = {
  str: z.number().int().min(3).max(20),
  dex: z.number().int().min(3).max(20),
  con: z.number().int().min(3).max(20),
  intel: z.number().int().min(3).max(20),
  wis: z.number().int().min(3).max(20),
  cha: z.number().int().min(3).max(20),
};

export function registerTools(server: McpServer): void {
  addTool(
    server,
    "redeem_invite",
    {
      title: "Redeem an invite code",
      description:
        "Redeem an invite code and claim a handle to receive an API key. Save the returned apiKey and send it on every future request as the header 'Authorization: Bearer <apiKey>'. No website login required.",
      inputSchema: {
        code: z.string().describe("The invite code you were given."),
        handle: z
          .string()
          .describe("A unique display name for you at the table (2-24 chars)."),
      },
    },
    async (args) => {
      try {
        return ok(
          await redeemInviteForApiToken(args.code as string, args.handle as string),
        );
      } catch (e) {
        if (e instanceof ActionError) return fail(e.message);
        throw e;
      }
    },
  );

  addTool(
    server,
    "whoami",
    {
      title: "Who am I",
      description:
        "Return the authenticated player's handle and a summary of their agents and campaigns.",
      inputSchema: {},
    },
    authed(async (playerId) => {
      const player = await prisma.player.findUnique({
        where: { id: playerId },
        select: {
          id: true,
          handle: true,
          _count: { select: { agents: true, campaigns: true } },
        },
      });
      return {
        id: player?.id,
        handle: player?.handle,
        agentCount: player?._count.agents ?? 0,
        campaignsCreated: player?._count.campaigns ?? 0,
      };
    }),
  );

  addTool(
    server,
    "get_rules",
    {
      title: "Get character-building rules",
      description:
        "List the available races, classes, skills (with governing ability), ability scores, and how the strictness dial changes DM behavior. Use this before create_agent or create_campaign.",
      inputSchema: {},
    },
    async () =>
      ok({
        races: RACES,
        classes: CLASSES,
        abilities: ABILITIES,
        skills: Object.entries(SKILLS).map(([name, ability]) => ({ name, ability })),
        maxProficientSkills: 4,
        strictness: {
          note: "0 = extremely loose sandbox, 100 = strict railroad. Default 50.",
          examples: [0, 25, 50, 75, 100].map((v) => ({
            value: v,
            label: strictnessLabel(v),
            guidance: strictnessGuidance(v),
          })),
        },
      }),
  );

  addTool(
    server,
    "create_agent",
    {
      title: "Create an adventurer",
      description:
        "Create an AI adventurer you control. Provide a vivid persona — it drives how the character acts. If abilities are omitted, the standard array is used. Up to 4 proficient skills.",
      inputSchema: {
        name: z.string(),
        race: z.string().describe("One of the races from get_rules."),
        className: z.string().describe("One of the classes from get_rules."),
        persona: z.string().describe("Personality / how this character behaves and speaks."),
        backstory: z.string().optional(),
        abilities: z.object(abilityShape).optional(),
        skills: z.array(z.string()).max(6).optional(),
      },
    },
    authed((playerId, args) =>
      createAgent(playerId, args as unknown as Parameters<typeof createAgent>[1]),
    ),
  );

  addTool(
    server,
    "list_my_agents",
    {
      title: "List my adventurers",
      description: "List the adventurers you own, with full character sheets.",
      inputSchema: {},
    },
    authed((playerId) => listAgents(playerId)),
  );

  addTool(
    server,
    "list_campaigns",
    {
      title: "List campaigns",
      description:
        "List all campaigns at the table (yours and others'), with status, party, and turn count. Use this to find a campaign to join or watch.",
      inputSchema: {},
    },
    authed((playerId) => listCampaigns(playerId)),
  );

  addTool(
    server,
    "create_campaign",
    {
      title: "Create a campaign",
      description:
        "Create a campaign the agentic DM will run from your story prompt. strictness 0-100 controls how tightly the DM follows the plot (0 = chaos, 100 = railroad).",
      inputSchema: {
        name: z.string(),
        storyPrompt: z.string().describe("The story spec / premise the DM colors in."),
        strictness: z.number().int().min(0).max(100).optional(),
      },
    },
    authed((playerId, args) =>
      createCampaign(playerId, args as unknown as Parameters<typeof createCampaign>[1]),
    ),
  );

  addTool(
    server,
    "join_campaign",
    {
      title: "Join a campaign",
      description: "Add one of your adventurers to a campaign's party (works before it starts).",
      inputSchema: {
        campaignId: z.string(),
        agentId: z.string().describe("An agent id from list_my_agents."),
      },
    },
    authed((playerId, args) =>
      joinCampaign(playerId, args.campaignId as string, args.agentId as string),
    ),
  );

  addTool(
    server,
    "start_campaign",
    {
      title: "Start a campaign",
      description:
        "Begin the adventure (creator only). The DM writes the opening scene. Requires at least one agent in the party.",
      inputSchema: { campaignId: z.string() },
    },
    authed((playerId, args) => startCampaignAsPlayer(playerId, args.campaignId as string)),
  );

  addTool(
    server,
    "get_campaign_state",
    {
      title: "Get campaign state",
      description:
        "Read the current state: recent adventure log, party vitals (HP/XP/level/gold/conditions/inventory), your agent ids, and chronicle recaps. Poll this to decide your next action.",
      inputSchema: {
        campaignId: z.string(),
        logLimit: z.number().int().min(1).max(100).optional(),
      },
    },
    authed((playerId, args) =>
      getCampaignState(
        playerId,
        args.campaignId as string,
        (args.logLimit as number | undefined) ?? 25,
      ),
    ),
  );

  addTool(
    server,
    "take_action",
    {
      title: "Take an action",
      description:
        "Have one of your agents attempt a free-form action, in character. The DM adjudicates it (rolling a d20 ability check when appropriate) and narrates the result. Returns the updated state.",
      inputSchema: {
        campaignId: z.string(),
        agentId: z.string(),
        actionText: z
          .string()
          .describe('What your agent does, e.g. "I bribe the guard with a gold coin."'),
      },
    },
    authed(async (playerId, args) => {
      await submitAction(
        playerId,
        args.campaignId as string,
        args.agentId as string,
        args.actionText as string,
      );
      return getCampaignState(playerId, args.campaignId as string, 12);
    }),
  );

  addTool(
    server,
    "advance_turn",
    {
      title: "Advance the story (autonomous turn)",
      description:
        "Let an agent act on its own (the DM picks an in-character action for it and resolves it). Pass agentId to advance a specific agent of yours, or omit it to let the next agent in the order act. Returns the updated state.",
      inputSchema: {
        campaignId: z.string(),
        agentId: z.string().optional(),
      },
    },
    authed(async (playerId, args) => {
      await advanceTurn(
        playerId,
        args.campaignId as string,
        args.agentId as string | undefined,
      );
      return getCampaignState(playerId, args.campaignId as string, 12);
    }),
  );

  addTool(
    server,
    "get_chronicle",
    {
      title: "Get the chronicle",
      description:
        "Return the campaign's milestone recaps as Markdown (the human-readable story-so-far), oldest first.",
      inputSchema: { campaignId: z.string() },
    },
    authed((playerId, args) => getChronicleMarkdown(playerId, args.campaignId as string)),
  );
}
