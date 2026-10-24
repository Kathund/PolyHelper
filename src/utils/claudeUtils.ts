import Anthropic from '@anthropic-ai/sdk';
import PolyHelperError from '../private/error.ts';
import zod from 'zod';
import { getErrorMessage } from './miscUtils.ts';
import type { AgentOptions, AgentUsage, ClientTool } from '../types/claude.ts';

const agentModel = 'claude-sonnet-5-5';
const wrapUpMessage =
  'You have reached your tool-call limit. Write your final reply now from what you have found so far.';

function isToolInputParseError(error: unknown): boolean {
  return (
    error instanceof Anthropic.AnthropicError &&
    !(error instanceof Anthropic.APIError) &&
    error.message.startsWith('Unable to parse tool parameter JSON')
  );
}

async function runTool(
  tools: Map<string, ClientTool>,
  use: Anthropic.Beta.BetaToolUseBlock,
  label: string
): Promise<Anthropic.Beta.BetaToolResultBlockParam> {
  try {
    const tool = tools.get(use.name);
    if (!tool) throw new PolyHelperError(`Unknown tool ${use.name}`);
    return { type: 'tool_result', tool_use_id: use.id, content: await tool.run(use.input) };
  } catch (error) {
    console.warn(`[${label}] Tool ${use.name} failed: ${getErrorMessage(error)}`);
    return { type: 'tool_result', tool_use_id: use.id, is_error: true, content: getErrorMessage(error) };
  }
}

function getFinalText(message: Anthropic.Beta.BetaMessage): string {
  const text = message.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('')
    .trim();
  if (!text) throw new PolyHelperError('Claude returned an empty reply');
  return text;
}

function addUsage(usage: AgentUsage, message: Anthropic.Beta.BetaMessage) {
  usage.turns++;
  usage.input += message.usage.input_tokens;
  usage.cacheRead += message.usage.cache_read_input_tokens ?? 0;
  usage.cacheWrite += message.usage.cache_creation_input_tokens ?? 0;
  usage.output += message.usage.output_tokens;
}

async function runTurns(options: AgentOptions, usage: AgentUsage): Promise<string> {
  const tools = new Map(options.tools.map((tool) => [tool.definition.name, tool]));
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    { role: 'user', content: [{ type: 'text', text: options.prompt }] }
  ];
  let jsonRetries = 0;

  for (let turn = 1; turn <= options.maxTurns; turn++) {
    const finalTurn = turn === options.maxTurns;
    const last = messages.at(-1);
    if (finalTurn && last?.role === 'user' && Array.isArray(last.content)) {
      last.content.push({ type: 'text', text: wrapUpMessage });
    }

    let message: Anthropic.Beta.BetaMessage;
    try {
      message = await options.client.beta.messages
        .stream({
          model: agentModel,
          max_tokens: 8000,
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
          cache_control: { type: 'ephemeral' },
          output_config: { effort: options.effort },
          system: [{ type: 'text', text: options.system, cache_control: { type: 'ephemeral' } }],
          tools: [...tools.values()].map((tool) => tool.definition),
          tool_choice: finalTurn ? { type: 'none' } : undefined,
          messages
        })
        .finalMessage();
      jsonRetries = 0;
    } catch (error) {
      if (!isToolInputParseError(error) || jsonRetries++ >= 2) throw error;
      console.warn(`[${options.label}] Unparseable tool input, retrying`);
      continue;
    }
    addUsage(usage, message);

    if (message.stop_reason === 'refusal') {
      throw new PolyHelperError(`Claude declined the request (${message.stop_details?.category ?? 'uncategorized'})`);
    }
    if (message.stop_reason === 'max_tokens') throw new PolyHelperError('Claude hit the output token limit');

    const toolUses = message.content.filter(
      (block): block is Anthropic.Beta.BetaToolUseBlock => block.type === 'tool_use'
    );
    if (message.stop_reason !== 'tool_use' || toolUses.length === 0) return getFinalText(message);

    messages.push({ role: 'assistant', content: message.content });
    messages.push({
      role: 'user',
      content: await Promise.all(toolUses.map((use) => runTool(tools, use, options.label)))
    });
  }

  throw new PolyHelperError(`Ran out of turns after ${options.maxTurns}`);
}

export function defineTool<T extends zod.ZodObject>(tool: {
  name: string;
  description: string;
  input: T;
  run: (input: zod.output<T>) => Promise<string>;
}): ClientTool {
  const schema = zod.toJSONSchema(tool.input, { io: 'input' });
  delete schema.$schema;
  return {
    definition: {
      name: tool.name,
      description: tool.description,
      input_schema: schema as Anthropic.Beta.BetaTool.InputSchema,
      eager_input_streaming: true
    },
    run: async (input) => {
      const parsed = tool.input.safeParse(input);
      if (!parsed.success) throw new PolyHelperError(`Invalid input: ${zod.prettifyError(parsed.error)}`);
      return await tool.run(parsed.data);
    }
  };
}

export async function runAgent(options: AgentOptions): Promise<string> {
  const usage: AgentUsage = { turns: 0, input: 0, cacheRead: 0, cacheWrite: 0, output: 0 };
  try {
    return await runTurns(options, usage);
  } finally {
    console.other(
      `[${options.label}] ${usage.turns} turns, ${usage.input} uncached input, ${usage.cacheRead} cache read, ${usage.cacheWrite} cache write, ${usage.output} output tokens`
    );
  }
}
