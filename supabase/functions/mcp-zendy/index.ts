/**
 * MCP Zendy - Tool execution server for WhatsApp AI
 * Called by whatsapp-ai-agent via supabase.functions.invoke('mcp-zendy')
 */

import { registerAllTools } from './tools/index.ts';
import { executeTool, registerToolHandler } from './tool-executor.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

// Register all tools (pass a no-op for mcp since we don't use the MCP server)
const noopMcp = {
  tool: () => {},
} as any;
registerAllTools(noopMcp, (name, handler) => registerToolHandler(name, handler));

console.log('[mcp-zendy] Tools registered, server ready');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  console.log(`[mcp-zendy] ${req.method} ${url.pathname}`);

  // GET / or GET /health
  if (req.method === 'GET') {
    return new Response(
      JSON.stringify({ status: 'ok', service: 'mcp-zendy' }),
      { headers: corsHeaders }
    );
  }

  // POST / — tool execution (main entry point for supabase.functions.invoke)
  if (req.method === 'POST') {
    try {
      const body = await req.json() as {
        name?: string;
        arguments?: Record<string, any>;
        context?: { restaurant_id?: string; customer_phone?: string };
      };
      const { name, arguments: args = {}, context = {} } = body;

      if (!name) {
        return new Response(
          JSON.stringify({ error: 'Missing tool name' }),
          { status: 400, headers: corsHeaders }
        );
      }

      const mergedArgs = { ...context, ...args };
      console.log(`[mcp-zendy] Executing tool: ${name}`, JSON.stringify(mergedArgs).slice(0, 200));

      const result = await executeTool(name, mergedArgs);
      const text = result.content?.[0]?.type === 'text' ? result.content[0].text : JSON.stringify(result);

      return new Response(
        JSON.stringify({ content: text }),
        { headers: corsHeaders }
      );
    } catch (err) {
      console.error('[mcp-zendy] execute error:', err);
      return new Response(
        JSON.stringify({ error: err instanceof Error ? err.message : 'Tool execution failed' }),
        { status: 500, headers: corsHeaders }
      );
    }
  }

  return new Response(
    JSON.stringify({ error: 'Method not allowed' }),
    { status: 405, headers: corsHeaders }
  );
});
