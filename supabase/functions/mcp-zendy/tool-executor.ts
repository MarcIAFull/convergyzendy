/**
 * Tool executor - runs tools by name for HTTP /execute endpoint
 * Used by whatsapp-ai-agent mcp-flow when calling tools via supabase.functions.invoke
 */

export type ToolHandler = (args: Record<string, unknown>) => Promise<{
  content: Array<{ type: 'text'; text: string }>;
}>;

export const toolHandlers: Record<string, ToolHandler> = {};

export function registerToolHandler(name: string, handler: ToolHandler) {
  toolHandlers[name] = handler;
}

export async function executeTool(
  name: string,
  args: Record<string, unknown>
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const handler = toolHandlers[name];
  if (!handler) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: `Unknown tool: ${name}` }) }],
    };
  }
  try {
    return await handler(args);
  } catch (err) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: err instanceof Error ? err.message : 'Tool execution failed',
          }),
        },
      ],
    };
  }
}
