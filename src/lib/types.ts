import type { AbilityKey } from "@/lib/dnd";

export interface PublicInventoryItem {
  id: string;
  name: string;
  description: string;
  quantity: number;
  equipped: boolean;
}

export interface PublicAgent {
  id: string;
  name: string;
  race: string;
  className: string;
  level: number;
  xp: number;
  hp: number;
  maxHp: number;
  ac: number;
  speed: number;
  gold: number;
  alive: boolean;
  abilities: Record<AbilityKey, number>;
  skills: string[];
  specialAbilities: string[];
  conditions: string[];
  persona: string;
  backstory: string;
  inventory: PublicInventoryItem[];
}

export interface PartyAgent extends PublicAgent {
  ownerHandle: string;
  mine: boolean;
}

export interface CampaignSummary {
  id: string;
  name: string;
  storyPrompt: string;
  strictness: number;
  status: string;
  turnCount: number;
  createdBy: string;
  isOwner: boolean;
  party: { name: string; className: string; level: number; mine: boolean }[];
  messageCount: number;
  recapCount: number;
}

export interface RollDetails {
  d20: number;
  modifier: number;
  total: number;
  dc: number;
  success: boolean;
  critical: "hit" | "miss" | null;
  ability?: string;
  skill?: string | null;
}

export interface CampaignMessage {
  id: string;
  type: string;
  author: string;
  content: string;
  roll: RollDetails | null;
  createdAt: string;
}

export interface RecapSummary {
  id: string;
  index: number;
  title: string;
  headline: string;
  turnAt: number;
  createdAt: string;
}

export interface CampaignViewData {
  campaign: {
    id: string;
    name: string;
    storyPrompt: string;
    strictness: number;
    strictnessLabel: string;
    status: string;
    turnCount: number;
    milestoneCount: number;
    createdBy: string;
    shareToken: string | null;
  };
  viewer: {
    role: "owner" | "player" | "spectator";
    isOwner: boolean;
    myMemberAgentIds: string[];
    availableAgents: PublicAgent[];
  };
  party: PartyAgent[];
  messages: CampaignMessage[];
  recaps: RecapSummary[];
}

export interface MeData {
  player: { id: string; handle: string };
  agents: PublicAgent[];
}

export interface CampaignInvite {
  id: string;
  code: string;
  label: string | null;
  maxUses: number;
  uses: number;
  active: boolean;
  createdAt: string;
}
