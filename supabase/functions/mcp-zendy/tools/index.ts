/**
 * MCP Zendy Tools - Central registration
 */

import type { McpServer } from 'mcp-lite';
import { z } from 'zod';
import { registerToolHandler } from '../tool-executor.ts';
import { registerSearchMenuTool } from './search-menu.ts';
import { registerGetCustomerHistoryTool } from './get-customer-history.ts';
import { registerGetProductAddonsTool } from './get-product-addons.ts';
import { registerAddonSelectionTools } from './addon-selection-tools.ts';
import { registerGetCartTool } from './cart-tools.ts';

export function registerAllTools(mcp: McpServer, registerExecutor?: (name: string, handler: (args: Record<string, unknown>) => Promise<{ content: Array<{ type: 'text'; text: string }> }>) => void) {
  mcp.tool(
    'test_ping',
    z.object({
      message: z.string().optional().describe('Optional message to echo back'),
    }),
    async ({ message }) => ({
      content: [
        {
          type: 'text' as const,
          text: `Pong! ${message ? `Received: ${message}` : 'MCP Zendy is ready.'}`,
        },
      ],
    }),
    { description: 'WHEN: Use to verify the MCP server is responding. Returns a simple pong.' }
  );

  registerSearchMenuTool(mcp, registerExecutor);
  registerGetCustomerHistoryTool(mcp, registerExecutor);
  registerGetProductAddonsTool(mcp, registerExecutor);
  registerAddonSelectionTools(mcp, registerExecutor);
  registerGetCartTool(mcp, registerExecutor);
}
