/**
 * Centralized Evolution API Client
 * Handles all WhatsApp API communications via Evolution API
 */

interface EvolutionConfig {
  apiUrl: string;
  apiKey: string;
  instanceName: string;
}

interface InstanceStatus {
  instance: {
    instanceName: string;
    status: string;
  };
  qrcode?: {
    code: string;
    base64: string;
  };
}

interface SendMessageResponse {
  key: {
    remoteJid: string;
    fromMe: boolean;
    id: string;
  };
  message: any;
  messageTimestamp: string;
  status: string;
}

/**
 * Get Evolution API configuration from environment variables
 */
function getConfig(): EvolutionConfig {
  const apiUrl = Deno.env.get('EVOLUTION_API_URL');
  const apiKey = Deno.env.get('EVOLUTION_API_KEY');
  const instanceName = Deno.env.get('EVOLUTION_INSTANCE_NAME');

  if (!apiUrl || !apiKey || !instanceName) {
    const missing = [];
    if (!apiUrl) missing.push('EVOLUTION_API_URL');
    if (!apiKey) missing.push('EVOLUTION_API_KEY');
    if (!instanceName) missing.push('EVOLUTION_INSTANCE_NAME');
    
    console.error('[EvolutionClient] Missing required environment variables:', missing.join(', '));
    throw new Error(`Evolution API not configured. Missing: ${missing.join(', ')}`);
  }

  return { apiUrl, apiKey, instanceName };
}

/**
 * Format phone number for WhatsApp (remove + and add @s.whatsapp.net)
 */
function formatPhoneNumber(phone: string): string {
  return phone.replace(/\+/g, '') + '@s.whatsapp.net';
}

/**
 * Get the current status of the WhatsApp instance
 */
export async function getInstanceStatus(): Promise<InstanceStatus> {
  const config = getConfig();
  const url = `${config.apiUrl}/instance/connectionState/${config.instanceName}`;
  
  console.log(`[EvolutionClient] Fetching instance status from ${url}`);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'apikey': config.apiKey,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[EvolutionClient] Failed to get instance status: ${response.status} - ${errorText}`);
      throw new Error(`Failed to get instance status: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('[EvolutionClient] Instance status retrieved successfully:', data.instance?.status);
    return data;
  } catch (error) {
    console.error('[EvolutionClient] Error getting instance status:', error);
    throw error;
  }
}

/**
 * Get QR code for WhatsApp instance connection
 */
export async function getInstanceQrCode(): Promise<{ code: string; base64: string }> {
  const config = getConfig();
  const url = `${config.apiUrl}/instance/connect/${config.instanceName}`;
  
  console.log(`[EvolutionClient] Fetching QR code from ${url}`);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'apikey': config.apiKey,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[EvolutionClient] Failed to get QR code: ${response.status} - ${errorText}`);
      throw new Error(`Failed to get QR code: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    if (!data.qrcode) {
      console.error('[EvolutionClient] No QR code in response. Instance might already be connected.');
      throw new Error('No QR code available. Instance might already be connected.');
    }

    console.log('[EvolutionClient] QR code retrieved successfully');
    return data.qrcode;
  } catch (error) {
    console.error('[EvolutionClient] Error getting QR code:', error);
    throw error;
  }
}

/**
 * Send a WhatsApp message via Evolution API
 * @param phone - Phone number (with or without +)
 * @param message - Text message to send
 * @returns Response from Evolution API
 */
export async function sendWhatsAppMessage(
  phone: string,
  message: string
): Promise<SendMessageResponse> {
  const config = getConfig();
  const formattedPhone = formatPhoneNumber(phone);
  const url = `${config.apiUrl}/message/sendText/${config.instanceName}`;
  
  console.log(`[EvolutionClient] Sending message to ${formattedPhone} via ${url}`);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': config.apiKey,
      },
      body: JSON.stringify({
        number: formattedPhone,
        text: message,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[EvolutionClient] Failed to send message: ${response.status} - ${errorText}`);
      throw new Error(`Failed to send message: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('[EvolutionClient] Message sent successfully:', data.key?.id);
    return data;
  } catch (error) {
    console.error('[EvolutionClient] Error sending message:', error);
    throw error;
  }
}
