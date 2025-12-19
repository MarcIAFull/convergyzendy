import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { validateAuthentication, badRequestResponse } from '../_shared/authMiddleware.ts';

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
    const { token } = await req.json();

    if (!token) {
      return badRequestResponse('Token é obrigatório', corsHeaders);
    }

    // Validate user is authenticated
    const authResult = await validateAuthentication(
      supabaseUrl,
      supabaseServiceKey,
      authHeader
    );

    if (!authResult.authorized || !authResult.userId) {
      return new Response(
        JSON.stringify({ error: 'Usuário não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create admin client
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Get user email
    const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(authResult.userId);
    
    if (!user?.email) {
      return badRequestResponse('Erro ao obter informações do usuário', corsHeaders);
    }

    console.log(`[Accept Invitation] Processing for user: ${user.email}`);

    // Find invitation by token
    const { data: invitation, error: invitationError } = await supabaseAdmin
      .from('team_invitations')
      .select('*')
      .eq('token', token)
      .eq('status', 'pending')
      .maybeSingle();

    if (invitationError) {
      console.error('[Accept Invitation] Error fetching invitation:', invitationError);
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar convite' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!invitation) {
      return new Response(
        JSON.stringify({ error: 'Convite não encontrado ou já foi aceito' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if invitation expired
    if (new Date(invitation.expires_at) < new Date()) {
      // Mark as expired
      await supabaseAdmin
        .from('team_invitations')
        .update({ status: 'expired' })
        .eq('id', invitation.id);

      return badRequestResponse('Este convite expirou', corsHeaders);
    }

    // Check if user email matches invitation (case insensitive)
    if (user.email.toLowerCase() !== invitation.email.toLowerCase()) {
      console.log(`[Accept Invitation] Email mismatch: ${user.email} vs ${invitation.email}`);
      return new Response(
        JSON.stringify({ 
          error: 'Este convite foi enviado para outro email',
          invitedEmail: invitation.email,
          currentEmail: user.email
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is already a member
    const { data: existingMember } = await supabaseAdmin
      .from('restaurant_owners')
      .select('id')
      .eq('restaurant_id', invitation.restaurant_id)
      .eq('user_id', authResult.userId)
      .maybeSingle();

    if (existingMember) {
      // Update invitation status anyway
      await supabaseAdmin
        .from('team_invitations')
        .update({ status: 'accepted', accepted_at: new Date().toISOString() })
        .eq('id', invitation.id);

      // Get restaurant for response
      const { data: restaurant } = await supabaseAdmin
        .from('restaurants')
        .select('*')
        .eq('id', invitation.restaurant_id)
        .single();

      return new Response(
        JSON.stringify({
          success: true,
          alreadyMember: true,
          restaurantId: invitation.restaurant_id,
          restaurant,
          message: 'Você já é membro deste restaurante'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create restaurant_owners entry
    const { error: ownershipError } = await supabaseAdmin
      .from('restaurant_owners')
      .insert({
        user_id: authResult.userId,
        restaurant_id: invitation.restaurant_id,
        role: invitation.role,
        permissions: invitation.permissions
      });

    if (ownershipError) {
      console.error('[Accept Invitation] Error creating ownership:', ownershipError);
      return new Response(
        JSON.stringify({ error: 'Erro ao adicionar membro ao restaurante' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update invitation status
    await supabaseAdmin
      .from('team_invitations')
      .update({ status: 'accepted', accepted_at: new Date().toISOString() })
      .eq('id', invitation.id);

    // Get full restaurant data
    const { data: restaurant } = await supabaseAdmin
      .from('restaurants')
      .select('*')
      .eq('id', invitation.restaurant_id)
      .single();

    console.log(`[Accept Invitation] User ${user.email} joined restaurant ${restaurant?.name}`);

    return new Response(
      JSON.stringify({
        success: true,
        restaurantId: invitation.restaurant_id,
        restaurant,
        role: invitation.role,
        message: `Você foi adicionado ao restaurante ${restaurant?.name}`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Accept Invitation] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
