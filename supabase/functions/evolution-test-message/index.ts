import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { sendWhatsAppMessage } from "../_shared/evolutionClient.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TestMessageRequest {
  phone: string;
  message: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone, message }: TestMessageRequest = await req.json();

    if (!phone || !message) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Missing required fields: phone and message' 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`[EvolutionTestMessage] Sending test message to ${phone}`);

    // Send message via Evolution API client
    const result = await sendWhatsAppMessage(phone, message);

    console.log('[EvolutionTestMessage] Test message sent successfully');

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Test message sent successfully',
        messageId: result.key?.id || null,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('[EvolutionTestMessage] Error sending test message:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send test message' 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
