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
});

// Register all tools (MCP + executor for /execute endpoint)
registerAllTools(mcp, (name, handler) => registerToolHandler(name, handler));

// Bind to HTTP transport
const transport = new StreamableHttpTransport();

// No basePath — Supabase delivers requests at the function root
const app = new Hono();

app.get('/', (c) => {
  return c.json({
    message: 'MCP Zendy - WhatsApp AI Tools',
    endpoints: {
      mcp: '/mcp',
      health: '/health',
      execute: '/execute',
    },
  });
});

app.get('/health', (c) => {
  return c.json({ status: 'ok', service: 'mcp-zendy' });
});

app.all('/mcp', async (c) => {
  const response = await transport.handleRequest(c.req.raw, mcp);
  return response;
});

// Tool execution handler
async function handleExecute(c: { req: { json: () => Promise<any> }; json: (obj: unknown, status?: number) => Response }) {
  try {
    const body = await c.req.json() as { name?: string; arguments?: Record<string, any>; context?: { restaurant_id?: string; customer_phone?: string } };
    const { name, arguments: args = {}, context = {} } = body;
    if (!name) return c.json({ error: 'Missing tool name' }, 400);
    const mergedArgs = { ...context, ...args };
    console.log(`[mcp-zendy] Executing tool: ${name}`, JSON.stringify(mergedArgs).slice(0, 200));
    const result = await executeTool(name, mergedArgs);
    const text = result.content?.[0]?.type === 'text' ? result.content[0].text : JSON.stringify(result);
    return c.json({ content: text });
  } catch (err) {
    console.error('[mcp-zendy] execute error:', err);
    return c.json({ error: err instanceof Error ? err.message : 'Tool execution failed' }, 500);
  }
}

app.post('/execute', handleExecute);
app.post('/', handleExecute); // supabase.functions.invoke POSTs to /

// Fallback 404 for unmatched routes
app.all('*', (c) => {
  const url = new URL(c.req.url);
  console.warn(`[mcp-zendy] 404 — unmatched route: ${c.req.method} ${url.pathname}`);
  return c.json({ error: 'Not found', method: c.req.method, path: url.pathname }, 404);
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  console.log(`[mcp-zendy] ${req.method} ${url.pathname}`);

  try {
    const res = await app.fetch(req);
    // Add CORS headers to all responses
    const headers = new Headers(res.headers);
    Object.entries(corsHeaders).forEach(([k, v]) => headers.set(k, v));
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
  } catch (error) {
    console.error('[mcp-zendy] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
