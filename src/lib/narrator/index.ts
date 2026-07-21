import { isLlmEnabled } from "@/lib/llm";
import { LlmNarrator } from "./llmNarrator";
import { MockNarrator } from "./mockNarrator";
import type { Narrator } from "./types";

export * from "./types";

export function getNarrator(): Narrator {
  return isLlmEnabled() ? new LlmNarrator() : new MockNarrator();
}
