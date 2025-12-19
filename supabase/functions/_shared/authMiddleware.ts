import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface AuthValidationResult {
  authorized: boolean;
  userId?: string;
  error?: string;
}

/**
 * Validates that the request has a valid JWT and the user has access to the specified restaurant
 * Uses service role client for database queries to avoid RLS conflicts
 */
export async function validateRestaurantAccess(
  supabaseUrl: string,
  supabaseServiceKey: string,
  authHeader: string | null,
  restaurantId: string
): Promise<AuthValidationResult> {
  // Check if Authorization header exists
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('[Auth Middleware] Missing or invalid Authorization header');
    return { authorized: false, error: 'Missing or invalid Authorization header' };
  }

  // Extract JWT token
  const token = authHeader.replace('Bearer ', '');

  // Create service role client for database operations
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    // Validate token and get user using the service role client
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError) {
      console.error('[Auth Middleware] Auth error:', authError.message);
      return { authorized: false, error: 'Invalid or expired token' };
    }

    if (!user) {
      console.log('[Auth Middleware] No user found for token');
      return { authorized: false, error: 'User not found' };
    }

    console.log(`[Auth Middleware] Token validated for user: ${user.id}`);

    // Check if user is a global admin using service role
    const { data: adminRole } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (adminRole) {
      console.log(`[Auth Middleware] User ${user.id} is global admin - access granted`);
      return { authorized: true, userId: user.id };
    }

    // Check if user is owner of the restaurant (original creator)
    const { data: restaurant } = await supabaseAdmin
      .from('restaurants')
      .select('user_id')
      .eq('id', restaurantId)
      .maybeSingle();

    if (restaurant?.user_id === user.id) {
      console.log(`[Auth Middleware] User ${user.id} is restaurant owner - access granted`);
      return { authorized: true, userId: user.id };
    }

    // Check if user has access via restaurant_owners table
    const { data: ownership } = await supabaseAdmin
      .from('restaurant_owners')
      .select('id, role')
      .eq('user_id', user.id)
      .eq('restaurant_id', restaurantId)
      .maybeSingle();

    if (ownership) {
      console.log(`[Auth Middleware] User ${user.id} has ${ownership.role} access to restaurant ${restaurantId}`);
      return { authorized: true, userId: user.id };
    }

    console.log(`[Auth Middleware] User ${user.id} has no access to restaurant ${restaurantId}`);
    return { authorized: false, error: 'Access denied to this restaurant' };

  } catch (error) {
    console.error('[Auth Middleware] Unexpected error:', error);
    return { authorized: false, error: 'Internal authentication error' };
  }
}

/**
 * Simpler validation that only checks if user is authenticated
 * Use this for endpoints that don't need restaurant-specific access
 */
export async function validateAuthentication(
  supabaseUrl: string,
  supabaseServiceKey: string,
  authHeader: string | null
): Promise<AuthValidationResult> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { authorized: false, error: 'Missing or invalid Authorization header' };
  }

  const token = authHeader.replace('Bearer ', '');

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      console.error('[Auth Middleware] Authentication failed:', authError?.message);
      return { authorized: false, error: 'Invalid or expired token' };
    }

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

/**
 * Helper to create bad request response
 */
export function badRequestResponse(error: string, corsHeaders: Record<string, string>) {
  return new Response(
    JSON.stringify({ error }),
    {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}
