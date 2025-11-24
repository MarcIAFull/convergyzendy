import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { validateRestaurantAccess, unauthorizedResponse } from '../_shared/authMiddleware.ts';

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

    if (!email || !restaurantId) {
      return new Response(
        JSON.stringify({ error: 'Email e restaurantId são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate user has access to restaurant
    const authResult = await validateRestaurantAccess(
      supabaseUrl,
      supabaseServiceKey,
      authHeader,
      restaurantId
    );

    if (!authResult.authorized) {
      return unauthorizedResponse(authResult.error || 'Acesso negado', corsHeaders);
    }

    // Create supabase client with service role
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if a user with this email exists and is already a member
    const { data: { users } } = await supabase.auth.admin.listUsers();
    const existingUser = users.find(u => u.email === email);
    
    if (existingUser) {
      const { data: existingMember } = await supabase
        .from('restaurant_owners')
        .select('id')
        .eq('restaurant_id', restaurantId)
        .eq('user_id', existingUser.id)
        .maybeSingle();

      if (existingMember) {
        return new Response(
          JSON.stringify({ error: 'Este usuário já é membro do restaurante' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Check for existing pending invitation
    const { data: existingInvitation } = await supabase
      .from('team_invitations')
      .select('id')
      .eq('restaurant_id', restaurantId)
      .eq('email', email)
      .eq('status', 'pending')
      .maybeSingle();

    if (existingInvitation) {
      return new Response(
        JSON.stringify({ error: 'Já existe um convite pendente para este email' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate unique token
    const token = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Expires in 7 days

    // Create invitation
    const { data: invitation, error: invitationError } = await supabase
      .from('team_invitations')
      .insert({
        restaurant_id: restaurantId,
        email,
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

    // Get restaurant name
    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('name')
      .eq('id', restaurantId)
      .single();

    // TODO: Send email with invitation link
    // For now, just return the token (in production, send via email service)
    const invitationUrl = `${req.headers.get('origin') || 'http://localhost:8080'}/accept-invitation/${token}`;

    console.log(`[Send Invitation] Created invitation for ${email} to ${restaurant?.name}`);
    console.log(`[Send Invitation] Invitation URL: ${invitationUrl}`);

    return new Response(
      JSON.stringify({
        success: true,
        invitation,
        invitationUrl,
        message: `Convite enviado para ${email}`
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