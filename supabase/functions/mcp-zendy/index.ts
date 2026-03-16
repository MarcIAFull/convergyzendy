/**
 * MCP Zendy - Model Context Protocol Server for WhatsApp AI
 * Replaces Orchestrator + Conversational AI flow when MCP_USE_MCP=true
 */

import { Hono } from 'hono';
import { McpServer, StreamableHttpTransport } from 'mcp-lite';
import { z } from 'zod';
import { registerAllTools } from './tools/index.ts';
import { executeTool, registerToolHandler } from './tool-executor.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Create MCP server instance
const mcp = new McpServer({
  name: 'mcp-zendy',
  version: '1.0.0',
  schemaAdapter: (schema) => z.toJSONSchema(schema as z.ZodType),
});

// Register all tools (MCP + executor for /execute endpoint)
registerAllTools(mcp, (name, handler) => registerToolHandler(name, handler));

// Bind to HTTP transport
const transport = new StreamableHttpTransport();
const httpHandler = transport.bind(mcp);

// Supabase passes full path e.g. /functions/v1/mcp-zendy or /functions/v1/mcp-zendy/mcp
const app = new Hono().basePath('/functions/v1/mcp-zendy');

app.get('/', (c) => {
  return c.json({
    message: 'MCP Zendy - WhatsApp AI Tools',
    endpoints: {
      mcp: '/mcp-zendy/mcp',
      health: '/mcp-zendy/health',
    },
  });
});

app.get('/health', (c) => {
  return c.json({ status: 'ok', service: 'mcp-zendy' });
});

app.all('/mcp', async (c) => {
  const response = await httpHandler(c.req.raw);
  return response;
});

// Tool execution: POST /execute or POST / (for supabase.functions.invoke)
async function handleExecute(c: { req: { json: () => Promise<unknown> }; json: (obj: unknown, status?: number) => Response }) {
  try {
    const body = await c.req.json() as { name?: string; arguments?: Record<string, unknown>; context?: { restaurant_id?: string; customer_phone?: string } };
    const { name, arguments: args = {}, context = {} } = body;
    if (!name) return c.json({ error: 'Missing tool name' }, 400);
    const mergedArgs = { ...context, ...args };
    const result = await executeTool(name, mergedArgs);
    const text = result.content?.[0]?.type === 'text' ? result.content[0].text : JSON.stringify(result);
    return c.json({ content: text });
  } catch (err) {
    console.error('[mcp-zendy] execute error:', err);
    return c.json({ error: err instanceof Error ? err.message : 'Tool execution failed' }, 500);
  }
}
app.post('/execute', handleExecute);
app.post('/', handleExecute); // For supabase.functions.invoke which POSTs to /

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const res = await app.fetch(req);
    return res;
  } catch (error) {
    console.error('[mcp-zendy] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
