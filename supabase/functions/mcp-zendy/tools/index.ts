/**
 * MCP Zendy Tools - Central registration
 */

import { registerSearchMenuTool } from './search-menu.ts';
import { registerGetCustomerHistoryTool } from './get-customer-history.ts';
import { registerGetProductAddonsTool } from './get-product-addons.ts';
import { registerAddonSelectionTools } from './addon-selection-tools.ts';
import { registerGetCartTool } from './cart-tools.ts';

type ToolHandler = (args: Record<string, any>) => Promise<{ content: Array<{ type: 'text'; text: string }> }>;
type ExecutorReg = (name: string, handler: ToolHandler) => void;

export function registerAllTools(mcp: any, registerExecutor?: ExecutorReg) {
  // Register test_ping directly with executor
  if (registerExecutor) {
    registerExecutor('test_ping', async (args) => ({
      content: [
        {
          type: 'text' as const,
          text: `Pong! ${args.message ? `Received: ${args.message}` : 'MCP Zendy is ready.'}`,
        },
      ],
    }));
  }

  registerSearchMenuTool(mcp, registerExecutor);
  registerGetCustomerHistoryTool(mcp, registerExecutor);
  registerGetProductAddonsTool(mcp, registerExecutor);
  registerAddonSelectionTools(mcp, registerExecutor);
  registerGetCartTool(mcp, registerExecutor);
}
