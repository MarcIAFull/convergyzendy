# Testing Structure

This directory contains the testing infrastructure for the Zendy Delivery AI system.

## Directory Structure

```
tests/
├── unit/           # Unit tests for utilities, stores, and hooks
├── integration/    # Integration tests for API calls and edge functions
├── e2e/            # End-to-end tests for complete user workflows
└── fixtures/       # Test data and mocks
```

## Testing Stack (To Be Implemented)

### Unit Testing - Vitest
- **Location**: `tests/unit/`
- **Purpose**: Test individual functions, hooks, and store logic
- **Examples**:
  - Store operations (menuStore, orderStore, etc.)
  - Utility functions (formatPhoneNumber, price calculations)
  - Custom hooks (useAuth, useRestaurantGuard)

### Integration Testing - Vitest + MSW
- **Location**: `tests/integration/`
- **Purpose**: Test API interactions and edge function logic
- **Examples**:
  - Supabase client calls
  - Edge function handlers
  - Real-time subscription behavior

### E2E Testing - Playwright/Cypress
- **Location**: `tests/e2e/`
- **Purpose**: Test complete user workflows from UI to database
- **Examples**:
  - Onboarding flow
  - WhatsApp connection
  - Order placement via AI
  - Message conversations

## Running Tests (Future)

```bash
# Unit tests
npm run test:unit

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# All tests
npm run test
```

## Manual Testing

For now, use the **System Check** page at `/system-check` to manually validate critical workflows after each deployment.

## Test Coverage Goals

- **Unit Tests**: 80%+ coverage on utilities and stores
- **Integration Tests**: All edge functions covered
- **E2E Tests**: All critical user paths covered

## Writing Tests

### Example Unit Test Structure
```typescript
import { describe, it, expect } from 'vitest';
import { formatPhoneNumber } from '@/lib/utils';

describe('formatPhoneNumber', () => {
  it('should format Brazilian phone numbers', () => {
    expect(formatPhoneNumber('+5511999999999')).toBe('5511999999999@s.whatsapp.net');
  });
});
```

### Example E2E Test Structure
```typescript
import { test, expect } from '@playwright/test';

test('complete onboarding flow', async ({ page }) => {
  await page.goto('/onboarding');
  // ... test steps
  expect(page.url()).toContain('/dashboard');
});
```
