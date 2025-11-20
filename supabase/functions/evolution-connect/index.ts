import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createOrConnectInstance, getInstanceStatus, getInstanceQrCode } from "../_shared/evolutionClient.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface StatusResponse {
  status: 'connected' | 'waiting_qr' | 'disconnected' | 'unknown';
  qr: {
    qrImageUrl: string | null;
    qrBase64: string | null;
  };
  lastCheckedAt: string;
  message?: string;
  error?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[EvolutionConnectAPI] Creating or connecting to instance');

    // Create or connect to the instance
    try {
      await createOrConnectInstance();
      console.log('[EvolutionConnectAPI] Instance created/connected successfully');
    } catch (error) {
      console.error('[EvolutionConnectAPI] Error creating/connecting instance:', error);
      // Continue to check status even if creation fails (instance might already exist)
    }

    // Wait a moment for the instance to initialize
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Fetch instance status
    const statusData = await getInstanceStatus();
    console.log('[EvolutionConnectAPI] Instance status:', statusData.instance?.status);

    // Map status
    let status: 'connected' | 'waiting_qr' | 'disconnected' | 'unknown' = 'unknown';
    const rawStatus = statusData.instance?.status?.toLowerCase() || '';

    if (rawStatus.includes('open') || rawStatus.includes('connected')) {
      status = 'connected';
    } else if (rawStatus.includes('close') || rawStatus.includes('disconnect')) {
      status = 'disconnected';
    } else if (rawStatus.includes('qr') || rawStatus.includes('connecting')) {
      status = 'waiting_qr';
    }

    const response: StatusResponse = {
      status,
      qr: {
        qrImageUrl: null,
        qrBase64: null,
      },
      lastCheckedAt: new Date().toISOString(),
      message: 'Instância criada/conectada com sucesso',
    };

    // If waiting for QR, try to get it
    if (status === 'waiting_qr' || status === 'disconnected') {
      try {
        const qrData = await getInstanceQrCode();
        response.qr = {
          qrImageUrl: qrData.code || null,
          qrBase64: qrData.base64 || null,
        };
        console.log('[EvolutionConnectAPI] QR code retrieved');
      } catch (qrError) {
        console.error('[EvolutionConnectAPI] Could not get QR code:', qrError);
        // Don't fail the entire request if QR fetch fails
      }
    }

    return new Response(
      JSON.stringify(response),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('[EvolutionConnectAPI] Error:', error);
    
    // Determine error message
    let errorMessage = 'Erro ao conectar à instância';
    if (error instanceof Error) {
      if (error.message.includes('not configured')) {
        errorMessage = 'Evolution API URL não configurado';
      } else if (error.message.includes('ECONNREFUSED')) {
        errorMessage = 'Falha ao conectar à Evolution API (ECONNREFUSED)';
      } else if (error.message.includes('404')) {
        errorMessage = 'Instância não encontrada';
      } else {
        errorMessage = error.message;
      }
    }

    const response: StatusResponse = {
      status: 'unknown',
      qr: {
        qrImageUrl: null,
        qrBase64: null,
      },
      lastCheckedAt: new Date().toISOString(),
      error: errorMessage,
    };

    return new Response(
      JSON.stringify(response),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  }
});
