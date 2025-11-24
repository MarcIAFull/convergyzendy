import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
      return new Response(
        JSON.stringify({ error: 'Token é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: {
        headers: authHeader ? { Authorization: authHeader } : {},
      },
    });

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Usuário não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find invitation
    const { data: invitation, error: invitationError } = await supabase
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
      return new Response(
        JSON.stringify({ error: 'Este convite expirou' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user email matches invitation
    if (user.email !== invitation.email) {
      return new Response(
        JSON.stringify({ error: 'Este convite não é para o seu email' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is already a member
    const { data: existingMember } = await supabase
      .from('restaurant_owners')
      .select('id')
      .eq('restaurant_id', invitation.restaurant_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existingMember) {
      // Update invitation status
      await supabase
        .from('team_invitations')
        .update({ status: 'accepted', accepted_at: new Date().toISOString() })
        .eq('id', invitation.id);

      return new Response(
        JSON.stringify({ error: 'Você já é membro deste restaurante' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create restaurant_owners entry
    const { error: ownershipError } = await supabase
      .from('restaurant_owners')
      .insert({
        user_id: user.id,
        restaurant_id: invitation.restaurant_id,
        role: invitation.role,
        permissions: invitation.permissions
      });

    if (ownershipError) {
      console.error('[Accept Invitation] Error creating ownership:', ownershipError);
      return new Response(
        JSON.stringify({ error: 'Erro ao adicionar membro' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update invitation status
    const { error: updateError } = await supabase
      .from('team_invitations')
      .update({ status: 'accepted', accepted_at: new Date().toISOString() })
      .eq('id', invitation.id);

    if (updateError) {
      console.error('[Accept Invitation] Error updating invitation:', updateError);
    }

    // Get restaurant name
    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('name')
      .eq('id', invitation.restaurant_id)
      .single();

    console.log(`[Accept Invitation] User ${user.email} joined restaurant ${restaurant?.name}`);

    return new Response(
      JSON.stringify({
        success: true,
        restaurantId: invitation.restaurant_id,
        restaurantName: restaurant?.name,
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