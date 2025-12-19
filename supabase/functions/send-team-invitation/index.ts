import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { validateRestaurantAccess, unauthorizedResponse, badRequestResponse } from '../_shared/authMiddleware.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authHeader = req.headers.get('Authorization');

    // Parse request body
    const { email, restaurantId, role, permissions } = await req.json();
    console.log('[Send Invitation] Request:', { email, restaurantId, role });

    // Validate required fields
    if (!email || !restaurantId) {
      return badRequestResponse('Email e restaurantId são obrigatórios', corsHeaders);
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return badRequestResponse('Email inválido', corsHeaders);
    }

    // Validate user has access to restaurant
    const authResult = await validateRestaurantAccess(
      supabaseUrl,
      supabaseServiceKey,
      authHeader,
      restaurantId
    );

    if (!authResult.authorized) {
      console.log('[Send Invitation] Authorization failed:', authResult.error);
      return unauthorizedResponse(authResult.error || 'Acesso negado', corsHeaders);
    }

    console.log('[Send Invitation] User authorized:', authResult.userId);

    // Create supabase admin client
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Check if user with this email is already a member
    const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = users?.find(u => u.email?.toLowerCase() === email.toLowerCase());

    if (existingUser) {
      // Check if already a member via restaurant_owners
      const { data: existingMember } = await supabaseAdmin
        .from('restaurant_owners')
        .select('id')
        .eq('restaurant_id', restaurantId)
        .eq('user_id', existingUser.id)
        .maybeSingle();

      if (existingMember) {
        return badRequestResponse('Este usuário já é membro do restaurante', corsHeaders);
      }

      // Also check if they're the original owner
      const { data: restaurant } = await supabaseAdmin
        .from('restaurants')
        .select('user_id')
        .eq('id', restaurantId)
        .single();

      if (restaurant?.user_id === existingUser.id) {
        return badRequestResponse('Este usuário já é o proprietário do restaurante', corsHeaders);
      }
    }

    // Check for existing pending invitation
    const { data: existingInvitation } = await supabaseAdmin
      .from('team_invitations')
      .select('id')
      .eq('restaurant_id', restaurantId)
      .ilike('email', email)
      .eq('status', 'pending')
      .maybeSingle();

    if (existingInvitation) {
      return badRequestResponse('Já existe um convite pendente para este email', corsHeaders);
    }

    // Generate unique token and expiration
    const token = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    // Create invitation
    const { data: invitation, error: invitationError } = await supabaseAdmin
      .from('team_invitations')
      .insert({
        restaurant_id: restaurantId,
        email: email.toLowerCase().trim(),
        role: role || 'member',
        permissions: permissions || { menu: true, orders: true, settings: false, analytics: true },
        token,
        expires_at: expiresAt.toISOString(),
        invited_by: authResult.userId,
        status: 'pending'
      })
      .select()
      .single();

    if (invitationError) {
      console.error('[Send Invitation] Error creating invitation:', invitationError);
      return new Response(
        JSON.stringify({ error: 'Erro ao criar convite' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get restaurant name for logging
    const { data: restaurant } = await supabaseAdmin
      .from('restaurants')
      .select('name')
      .eq('id', restaurantId)
      .single();

    // Build invitation URL
    const origin = req.headers.get('origin') || req.headers.get('referer')?.replace(/\/$/, '') || 'https://app.example.com';
    const invitationUrl = `${origin}/accept-invitation/${token}`;

    console.log(`[Send Invitation] Created invitation for ${email} to ${restaurant?.name}`);

    return new Response(
      JSON.stringify({
        success: true,
        invitation: {
          id: invitation.id,
          email: invitation.email,
          role: invitation.role,
          token: invitation.token,
          expires_at: invitation.expires_at
        },
        invitationUrl,
        message: `Convite criado para ${email}`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Send Invitation] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
