import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface AuthValidationResult {
  authorized: boolean;
  userId?: string;
  error?: string;
}

/**
 * Validates that the request has a valid JWT and the user has access to the specified restaurant
 */
export async function validateRestaurantAccess(
  supabaseUrl: string,
  supabaseServiceKey: string,
  authHeader: string | null,
  restaurantId: string
): Promise<AuthValidationResult> {
  // Check if Authorization header exists
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { authorized: false, error: 'Missing or invalid Authorization header' };
  }

  // Extract JWT token
  const token = authHeader.replace('Bearer ', '');

  // Create Supabase client
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

  try {
    // Validate token and get user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('[Auth Middleware] Authentication failed:', authError);
      return { authorized: false, error: 'Invalid or expired token' };
    }

    // Check if user is a global admin
    const { data: adminRole, error: adminError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (adminRole) {
      console.log(`[Auth Middleware] User ${user.id} is global admin - access granted`);
      return { authorized: true, userId: user.id };
    }

    // Check if user has access to this restaurant
    const { data: ownership, error: ownershipError } = await supabase
      .from('restaurant_owners')
      .select('id')
      .eq('user_id', user.id)
      .eq('restaurant_id', restaurantId)
      .maybeSingle();

    if (ownershipError) {
      console.error('[Auth Middleware] Error checking ownership:', ownershipError);
      return { authorized: false, error: 'Error validating restaurant access' };
    }

    if (!ownership) {
      console.log(`[Auth Middleware] User ${user.id} has no access to restaurant ${restaurantId}`);
      return { authorized: false, error: 'Access denied to this restaurant' };
    }

    console.log(`[Auth Middleware] User ${user.id} authorized for restaurant ${restaurantId}`);
    return { authorized: true, userId: user.id };
  } catch (error) {
    console.error('[Auth Middleware] Unexpected error:', error);
    return { authorized: false, error: 'Internal authentication error' };
  }
}

/**
 * Helper to create unauthorized response
 */
export function unauthorizedResponse(error: string, corsHeaders: Record<string, string>) {
  return new Response(
    JSON.stringify({ error }),
    {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}
