interface EvolutionConfig {
  apiUrl: string;
  apiKey: string;
}

interface InstanceStatus {
  instance?: {
    state: string;
    status?: string;
    owner?: string;
  };
}

interface SendMessageResponse {
  key: {
    remoteJid: string;
    fromMe: boolean;
    id: string;
  };
}

function getConfig(): EvolutionConfig {
  const apiUrl = Deno.env.get('EVOLUTION_API_URL');
  const apiKey = Deno.env.get('EVOLUTION_API_KEY');

  if (!apiUrl || !apiKey) {
    throw new Error('Evolution API configuration missing. Please configure EVOLUTION_API_URL and EVOLUTION_API_KEY secrets.');
  }

  // Remove trailing slashes from apiUrl to prevent double-slash in URLs
  const normalizedApiUrl = apiUrl.replace(/\/+$/, '');

  return { apiUrl: normalizedApiUrl, apiKey };
}

function getAuthHeaders(apiKey: string): Record<string, string> {
  return {
    'apikey': apiKey,
    'Content-Type': 'application/json',
  };
}

async function validateApiConnection(): Promise<void> {
  const { apiUrl, apiKey } = getConfig();
  
  console.log(`[evolutionClient] Validating connection to: ${apiUrl}`);
  console.log(`[evolutionClient] API key format: ${apiKey.substring(0, 10)}...`);
  
  try {
    const response = await fetch(`${apiUrl}/instance/fetchInstances`, {
      method: 'GET',
      headers: getAuthHeaders(apiKey),
    });

    console.log(`[evolutionClient] Validation response status: ${response.status}`);

    if (response.status === 401 || response.status === 403) {
      const errorBody = await response.text();
      console.error(`[evolutionClient] Auth failed:`, errorBody);
      throw new Error('INVALID_API_KEY: Evolution API key is invalid or unauthorized');
    }
    
    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`[evolutionClient] API error:`, errorBody);
      throw new Error(`API_UNREACHABLE: Evolution API returned status ${response.status}`);
    }
    
    console.log(`[evolutionClient] API connection validated successfully`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('INVALID_API_KEY') || errorMessage.includes('API_UNREACHABLE')) {
      throw error;
    }
    throw new Error(`API_CONNECTION_FAILED: Cannot reach Evolution API - ${errorMessage}`);
  }
}

export function formatPhoneNumber(phone: string): string {
  // Remove any non-digit characters
  let cleaned = phone.replace(/\D/g, '');
  
  // If it doesn't start with country code, assume Brazil (+55)
  if (!cleaned.startsWith('55')) {
    cleaned = '55' + cleaned;
  }
  
  return cleaned + '@s.whatsapp.net';
}

export async function getInstanceStatus(instanceName: string): Promise<InstanceStatus> {
  const { apiUrl, apiKey } = getConfig();
  
  const response = await fetch(
    `${apiUrl}/instance/connectionState/${instanceName}`,
    {
      method: 'GET',
      headers: getAuthHeaders(apiKey),
    }
  );

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`[evolutionClient] Status check failed for ${instanceName}:`, errorBody);
    
    // Create error with status code property for better error handling
    const error: any = new Error(`Evolution API status check failed: ${response.status}`);
    error.statusCode = response.status;
    error.responseBody = errorBody;
    throw error;
  }

  return await response.json();
}

export async function getInstanceQrCode(instanceName: string): Promise<{ code: string; base64: string }> {
  const { apiUrl, apiKey } = getConfig();
  
  const response = await fetch(
    `${apiUrl}/instance/connect/${instanceName}`,
    {
      method: 'GET',
      headers: getAuthHeaders(apiKey),
    }
  );

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`[evolutionClient] QR fetch failed for ${instanceName}:`, errorBody);
    throw new Error(`Evolution API QR code fetch failed: ${response.status}`);
  }

  return await response.json();
}

export async function createOrConnectInstance(instanceName: string, webhookUrl?: string): Promise<any> {
  // Validate API connection first
  console.log(`[evolutionClient] Validating Evolution API connection...`);
  await validateApiConnection();
  
  const { apiUrl, apiKey } = getConfig();
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  
  const webhookUrlToUse = webhookUrl || `${supabaseUrl}/functions/v1/whatsapp-webhook`;
  
  const payload = {
    instanceName,
    qrcode: true,
    integration: "WHATSAPP-BAILEYS",
    webhook: {
      enabled: true,
      url: webhookUrlToUse,
      webhookByEvents: false,
      webhookBase64: true,
      events: [
        "MESSAGES_UPSERT",
        "MESSAGES_UPDATE",
        "CONNECTION_UPDATE"
      ]
    },
    settings: {
      rejectCall: false,
      msgCall: "Desculpe, não atendo chamadas.",
      groupsIgnore: true,
      alwaysOnline: true,
      readMessages: false,
      readStatus: false,
      syncFullHistory: false
    }
  };

  console.log(`[evolutionClient] Creating instance ${instanceName} with webhook: ${webhookUrlToUse}`);

  const response = await fetch(
    `${apiUrl}/instance/create`,
    {
      method: 'POST',
      headers: getAuthHeaders(apiKey),
      body: JSON.stringify(payload),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[evolutionClient] Instance creation failed:`, errorText);
    
    // If instance already exists (403 Forbidden or 409 Conflict), try to get its status
    const isAlreadyExists = 
      response.status === 403 || 
      response.status === 409 || 
      errorText.includes('already exists') || 
      errorText.includes('already in use');
    
    if (isAlreadyExists) {
      console.log(`[evolutionClient] Instance ${instanceName} already exists, fetching status`);
      try {
        const status = await getInstanceStatus(instanceName);
        const qrCode = await getInstanceQrCode(instanceName);
        return {
          ...qrCode,
          alreadyExists: true,
          existingStatus: status
        };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error(`[evolutionClient] Failed to get existing instance info:`, errorMsg);
        throw new Error(`Instance exists but cannot fetch status: ${errorMsg}`);
      }
    }
    
    throw new Error(`Evolution API instance creation failed: ${response.status} - ${errorText}`);
  }

  return await response.json();
}

export async function sendWhatsAppMessage(
  instanceName: string,
  phone: string,
  message: string
): Promise<SendMessageResponse> {
  const { apiUrl, apiKey } = getConfig();
  
  const formattedPhone = formatPhoneNumber(phone);
  
  const payload = {
    number: formattedPhone,
    text: message,
    delay: 1000,
  };

  console.log(`[evolutionClient] Sending message via instance ${instanceName} to ${formattedPhone}`);

  const response = await fetch(
    `${apiUrl}/message/sendText/${instanceName}`,
    {
      method: 'POST',
      headers: getAuthHeaders(apiKey),
      body: JSON.stringify(payload),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to send WhatsApp message: ${response.status} - ${errorText}`);
  }

  return await response.json();
}
