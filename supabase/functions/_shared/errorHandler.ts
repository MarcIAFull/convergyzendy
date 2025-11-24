/**
 * Centralized Error Handling Utilities
 * Provides consistent error responses and logging across all edge functions
 */

export interface ErrorResponse {
  success: false;
  error: string;
  code?: string;
  details?: any;
  timestamp: string;
}

export interface SuccessResponse<T = any> {
  success: true;
  data?: T;
  message?: string;
  timestamp: string;
}

/**
 * Standardized error codes
 */
export const ErrorCodes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  EXTERNAL_API_ERROR: 'EXTERNAL_API_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

/**
 * Creates a standardized error response
 */
export function createErrorResponse(
  error: string,
  code?: string,
  details?: any
): ErrorResponse {
  return {
    success: false,
    error,
    code,
    details,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Creates a standardized success response
 */
export function createSuccessResponse<T>(
  data?: T,
  message?: string
): SuccessResponse<T> {
  return {
    success: true,
    data,
    message,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Wraps an async function with error handling
 */
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  context: string
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    console.error(`[${context}] Error:`, error);
    throw error;
  }
}

/**
 * Extracts user-friendly error message from various error types
 */
export function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as any).message);
  }
  return 'An unexpected error occurred';
}

/**
 * Logs error with context and metadata
 */
export function logError(
  context: string,
  error: unknown,
  metadata?: Record<string, any>
) {
  console.error(`[${context}] Error occurred:`, {
    error: extractErrorMessage(error),
    stack: error instanceof Error ? error.stack : undefined,
    metadata,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Creates a Response object with error details
 */
export function createErrorHttpResponse(
  error: string,
  statusCode: number = 500,
  code?: string,
  corsHeaders: Record<string, string> = {}
): Response {
  return new Response(
    JSON.stringify(createErrorResponse(error, code)),
    {
      status: statusCode,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    }
  );
}

/**
 * Creates a Response object with success details
 */
export function createSuccessHttpResponse<T>(
  data?: T,
  message?: string,
  corsHeaders: Record<string, string> = {}
): Response {
  return new Response(
    JSON.stringify(createSuccessResponse(data, message)),
    {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    }
  );
}

/**
 * Retry logic for external API calls
 */
export async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: unknown;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      console.warn(`Attempt ${attempt}/${maxRetries} failed:`, extractErrorMessage(error));
      
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
      }
    }
  }
  
  throw lastError;
}
