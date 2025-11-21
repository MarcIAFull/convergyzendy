# AI Configuration System

## Overview

The AI Configuration module provides a complete agent management console for the WhatsApp ordering system. It allows you to configure both AI agents (Orchestrator and Conversational AI) through the UI without modifying code.

## Architecture

### Database-Driven Configuration

The system uses three main tables:

1. **`agents`** - Core agent configuration (model, temperature, max_tokens, etc.)
2. **`agent_prompt_blocks`** - Modular prompt system with drag-and-drop ordering
3. **`agent_tools`** - Tool management with custom descriptions and usage rules

### Template Variables

Prompts support template variables that are replaced at runtime:

- `{{restaurant_name}}` - Restaurant name
- `{{menu_products}}` - Formatted product list with addons
- `{{cart_summary}}` - Current cart contents and total
- `{{customer_info}}` - Customer profile data
- `{{pending_items}}` - Pending products awaiting confirmation
- `{{conversation_history}}` - Recent message history
- `{{current_state}}` - Current conversation state
- `{{user_intent}}` - Orchestrator's classified intent
- `{{target_state}}` - Target conversation state
- `{{pending_product}}` - Product offered by agent

### Safe Fallbacks

If database configuration is missing or broken, the system automatically falls back to hard-coded prompts and tool definitions from:
- `orchestrator-prompt.ts`
- `conversational-ai-prompt.ts`
- `base-tools.ts`

## Getting Started

### 1. Seed the Prompt Blocks

Run the seed script to populate the database with production-ready prompts:

```bash
# From the Supabase SQL Editor
psql -h <your-db-host> -U postgres -d postgres -f supabase/seed-agent-prompts.sql
```

Or run it directly from the Supabase dashboard SQL editor.

### 2. Access the AI Configuration Page

Navigate to `/ai-configuration` in your admin dashboard.

### 3. Configure Agents

#### Model Settings
- Select AI model (OpenAI GPT models)
- Adjust temperature (0.0 - 2.0)
- Set max_tokens
- Configure advanced parameters (top_p, frequency_penalty, presence_penalty)

#### System Prompt Builder
- Drag to reorder prompt blocks
- Click to edit block content
- Add new blocks with custom content
- Locked blocks (🔒) cannot be deleted
- Template variables are automatically replaced at runtime

#### Tools Manager
- Drag tools from "Available" to "Enabled" sections
- Reorder tools by dragging
- Override tool descriptions
- Add usage rules (injected into prompt automatically)

#### Orchestration Rules (Orchestrator only)
- Configure decision hints per intent
- Specify allowed tools per intent

#### Behavior Settings
- Customer profile management
  - Auto-load by phone
  - Update name from conversation
  - Update address/payment on confirmation
- Pending products
  - Allow multiple items
  - Set expiration time

## Runtime Behavior

### Edge Function Flow

1. **Load Agent Config** - Fetch agents, prompt blocks, and tools from database
2. **Build System Prompts** - Concatenate blocks and replace template variables
3. **Dynamic Tool List** - Build tools array from enabled tools with overrides
4. **Inject Sections** - Add tool usage rules, behavior config, orchestration rules
5. **API Calls** - Use database config for model, temperature, max_tokens
6. **Fallback** - If DB config missing, use hard-coded defaults

### Logging

All configuration decisions are logged:
```
[Agent Config] Orchestrator: ✅ Loaded from DB (ID: xxx, Model: gpt-4o)
[Agent Config] Orchestrator prompt blocks: 2 blocks loaded
[Agent Config] Enabled tools: 9 tools configured
[Orchestrator] Using database-configured prompt with template variables
```

## Development Workflow

### Making Changes

1. **Edit in UI** - Make changes in AI Configuration page
2. **Save** - Changes are written to database
3. **Test** - Next message uses new configuration
4. **Monitor** - Check edge function logs for configuration details

### Testing Changes

1. Open AI Configuration page
2. Make desired changes
3. Click "Save"
4. Send a test message via WhatsApp
5. Check edge function logs to verify:
   - Which config was loaded (DB vs fallback)
   - Template variables applied correctly
   - Tools configured properly

### Rollback Strategy

If changes cause issues:

1. **UI Revert** - Use "Revert Changes" button before saving
2. **Reset to Defaults** - Re-run seed script to restore defaults
3. **Fallback Mode** - Delete agent records to trigger fallback to hard-coded prompts

## Best Practices

### Prompt Design

- ✅ Use template variables for dynamic content
- ✅ Keep blocks focused and modular
- ✅ Lock critical system blocks to prevent accidental edits
- ✅ Test with various customer scenarios
- ❌ Don't hardcode restaurant names or product lists
- ❌ Don't make blocks too long (split into multiple)

### Tool Configuration

- ✅ Add usage rules to guide when tools should be called
- ✅ Override descriptions to match your use case
- ✅ Disable unused tools to simplify prompts
- ✅ Test tool combinations thoroughly
- ❌ Don't enable all tools by default
- ❌ Don't forget to add usage rules for custom behavior

### Model Selection

- **Orchestrator**: Use fast models (gpt-4o-mini, claude-3-5-haiku)
- **Conversational AI**: Use capable models (gpt-4o, claude-sonnet-4-5)
- **Temperature**: Lower for orchestrator (0.2), moderate for conversational (0.7)
- **Max Tokens**: Lower for orchestrator (500), higher for conversational (1000)

## Troubleshooting

### Issue: Changes not reflected in runtime

**Solution**: Check edge function logs for:
```
[Agent Config] Orchestrator: ⚠️ Using fallback (hard-coded)
```

If you see this, the database config isn't being loaded. Verify:
1. Agent exists with `is_active = true`
2. Prompt blocks exist for the agent
3. No SQL errors in logs

### Issue: Empty responses from AI

**Solution**: Check that:
1. System prompt includes instructions to always respond
2. Temperature isn't too low (< 0.1)
3. Max tokens isn't too restrictive (< 100)
4. Prompt blocks are in correct order

### Issue: Tools not being called

**Solution**: Verify:
1. Tools are enabled in agent_tools table
2. Tool usage rules are clear
3. Orchestrator intent maps to appropriate tools
4. Prompt includes tool calling instructions

## Advanced Features

### Custom Template Variables

Add new template variables by:

1. Update `applyTemplateVariables()` function
2. Add to formatting helpers (e.g., `formatCustomerForPrompt`)
3. Document in prompt blocks

### Multi-Language Support

1. Add language field to agents table
2. Create language-specific prompt blocks
3. Load blocks based on customer language preference
4. Update template variable formatters

### A/B Testing

1. Create multiple agents with different configs
2. Route customers to different agents
3. Track performance metrics
4. Promote winning configuration

## Monitoring

### Key Metrics

- Intent classification accuracy
- Tool execution success rate
- Average response time
- Fallback usage frequency
- Configuration load errors

### Log Analysis

Monitor these log entries:
- `[Agent Config]` - Configuration loading
- `[Orchestrator]` - Intent classification
- `[Main AI]` - Tool selection
- `[Tool Execution]` - Tool results

## Migration Path

### From Hard-Coded to Database

1. ✅ Phase 1 (Current): Load config from DB with fallbacks
2. ⬜ Phase 2: Remove hard-coded prompts entirely
3. ⬜ Phase 3: Add versioning and rollback
4. ⬜ Phase 4: Multi-restaurant support
5. ⬜ Phase 5: Analytics and optimization

## Support

For issues or questions:
1. Check edge function logs
2. Review prompt blocks in database
3. Test with fallback mode
4. Review this documentation
