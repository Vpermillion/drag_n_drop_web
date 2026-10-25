/** Provider-neutral contract. Live models and prices must be verified before activation. */
export type TextPatch = { op: "replaceText"; nodeId: string; text: string };
export interface CompositionAssistant {
  readonly mode: "fixture" | "live";
  proposeText(nodeId: string, requestedText: string): TextPatch;
}
export class FixtureAssistant implements CompositionAssistant {
  readonly mode = "fixture" as const;
  proposeText(nodeId: string, requestedText: string): TextPatch {
    return { op: "replaceText", nodeId, text: requestedText };
  }
}
