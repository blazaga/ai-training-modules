import { DomainError } from '../common/errors/domain-error.js';

/** An MCP tool result: content blocks, and `isError` for failures the model should see. */
export interface ToolResult {
  [key: string]: unknown;
  content: { type: 'text'; text: string }[];
  isError?: boolean;
}

/**
 * Run a tool body and shape its result. A DomainError (not found, rule
 * violation) becomes a TOOL error (`isError: true`), which the model can read
 * and react to. Anything else is a real failure, so it propagates and becomes
 * a protocol error.
 */
export async function runTool(
  body: () => Promise<unknown>,
): Promise<ToolResult> {
  try {
    const value = await body();
    return {
      content: [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    };
  } catch (error) {
    if (error instanceof DomainError) {
      return {
        isError: true,
        content: [{ type: 'text', text: `${error.code}: ${error.message}` }],
      };
    }
    throw error;
  }
}
