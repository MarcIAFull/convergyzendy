import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.83.0';

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
    const { slug, restaurantId } = await req.json();

    if (!slug || !restaurantId) {
      return new Response(
        JSON.stringify({ error: 'Missing slug or restaurantId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validar formato do slug
    const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    if (!slugRegex.test(slug)) {
      return new Response(
        JSON.stringify({ 
          available: false, 
          message: 'Slug inválido. Use apenas letras minúsculas, números e hífens.' 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verificar se slug já existe (excluindo o próprio restaurante)
    const { data: existingSlug, error } = await supabase
      .from('restaurant_settings')
      .select('slug, restaurant_id')
      .eq('slug', slug)
      .neq('restaurant_id', restaurantId)
      .maybeSingle();

    if (error) {
      console.error('Error checking slug:', error);
      return new Response(
        JSON.stringify({ error: 'Database error', details: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (existingSlug) {
      // Slug já existe, sugerir alternativa
      const suggestion = `${slug}-${Math.floor(Math.random() * 1000)}`;
      return new Response(
        JSON.stringify({ 
          available: false, 
          suggestion,
          message: 'Slug já está em uso'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Slug disponível
    return new Response(
      JSON.stringify({ 
        available: true,
        message: 'Slug disponível' 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in check-slug-availability:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
