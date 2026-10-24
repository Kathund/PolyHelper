import type Anthropic from '@anthropic-ai/sdk';

export type AgentEffort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

export interface ClientTool {
  definition: Anthropic.Beta.BetaTool;
  run(input: unknown): Promise<string>;
}

export interface AgentOptions {
  client: Anthropic;
  label: string;
  system: string;
  prompt: string;
  tools: ClientTool[];
  effort: AgentEffort;
  maxTurns: number;
}

export interface AgentUsage {
  turns: number;
  input: number;
  cacheRead: number;
  cacheWrite: number;
  output: number;
}
