import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getInstanceStatus, getInstanceQrCode } from "../_shared/evolutionClient.ts";

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
  error?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const lastCheckedAt = new Date().toISOString();

  try {
    console.log('[EvolutionStatus] Fetching instance status and QR code');

    // Get instance status
    let instanceStatus;
    try {
      instanceStatus = await getInstanceStatus();
    } catch (error) {
      console.error('[EvolutionStatus] Failed to get instance status:', error);
      return new Response(
        JSON.stringify({
          status: 'unknown',
          qr: {
            qrImageUrl: null,
            qrBase64: null,
          },
          lastCheckedAt,
          error: 'Failed to check instance status',
        } as StatusResponse),
        {
          status: 200, // Return 200 even on error so frontend can handle gracefully
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Determine connection status from Evolution API response
    const rawStatus = instanceStatus.instance?.status?.toLowerCase() || 'unknown';
    let status: StatusResponse['status'] = 'unknown';
    
    if (rawStatus === 'open' || rawStatus === 'connected') {
      status = 'connected';
    } else if (rawStatus === 'close' || rawStatus === 'closed' || rawStatus === 'disconnected') {
      status = 'disconnected';
    } else if (rawStatus === 'connecting' || rawStatus === 'qr') {
      status = 'waiting_qr';
    }

    console.log(`[EvolutionStatus] Instance status: ${rawStatus} -> mapped to: ${status}`);

    // Try to get QR code if not connected
    let qrData = null;
    if (status !== 'connected') {
      try {
        qrData = await getInstanceQrCode();
        console.log('[EvolutionStatus] QR code retrieved successfully');
      } catch (error) {
        // QR code might not be available if already connected or in transition
        console.log('[EvolutionStatus] QR code not available (this is normal if already connected)');
      }
    }

    const response: StatusResponse = {
      status,
      qr: {
        qrImageUrl: qrData?.code || null,
        qrBase64: qrData?.base64 || null,
      },
      lastCheckedAt,
    };

    console.log('[EvolutionStatus] Returning response:', { status: response.status, hasQr: !!qrData });

    return new Response(
      JSON.stringify(response),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('[EvolutionStatus] Unexpected error:', error);
    
    const errorResponse: StatusResponse = {
      status: 'unknown',
      qr: {
        qrImageUrl: null,
        qrBase64: null,
      },
      lastCheckedAt,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };

    return new Response(
      JSON.stringify(errorResponse),
      {
        status: 200, // Return 200 to allow graceful frontend handling
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
