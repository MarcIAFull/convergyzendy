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

// List of valid international country codes (most common)
const COUNTRY_CODES = [
  '351', // Portugal
  '55',  // Brazil
  '34',  // Spain
  '33',  // France
  '44',  // UK
  '1',   // USA/Canada
  '49',  // Germany
  '39',  // Italy
  '31',  // Netherlands
  '32',  // Belgium
  '41',  // Switzerland
  '43',  // Austria
  '353', // Ireland
  '352', // Luxembourg
  '356', // Malta
  '358', // Finland
  '359', // Bulgaria
  '370', // Lithuania
  '371', // Latvia
  '372', // Estonia
  '373', // Moldova
  '374', // Armenia
  '375', // Belarus
  '376', // Andorra
  '377', // Monaco
  '378', // San Marino
  '380', // Ukraine
  '381', // Serbia
  '382', // Montenegro
  '383', // Kosovo
  '385', // Croatia
  '386', // Slovenia
  '387', // Bosnia
  '389', // North Macedonia
  '420', // Czech Republic
  '421', // Slovakia
  '423', // Liechtenstein
  '48',  // Poland
  '45',  // Denmark
  '46',  // Sweden
  '47',  // Norway
  '30',  // Greece
  '36',  // Hungary
  '40',  // Romania
  '7',   // Russia
  '61',  // Australia
  '64',  // New Zealand
  '81',  // Japan
  '82',  // South Korea
  '86',  // China
  '91',  // India
  '52',  // Mexico
  '54',  // Argentina
  '56',  // Chile
  '57',  // Colombia
  '58',  // Venezuela
  '212', // Morocco
  '213', // Algeria
  '216', // Tunisia
  '20',  // Egypt
  '27',  // South Africa
  '234', // Nigeria
  '254', // Kenya
  '255', // Tanzania
  '256', // Uganda
  '971', // UAE
  '966', // Saudi Arabia
  '965', // Kuwait
  '974', // Qatar
  '968', // Oman
  '973', // Bahrain
  '962', // Jordan
  '961', // Lebanon
  '90',  // Turkey
  '972', // Israel
  '60',  // Malaysia
  '62',  // Indonesia
  '63',  // Philippines
  '65',  // Singapore
  '66',  // Thailand
  '84',  // Vietnam
];

export function formatPhoneNumber(phone: string): string {
  console.log(`[formatPhoneNumber] Input: "${phone}"`);
  
  // If already has suffix @lid, @s.whatsapp.net or @c.us, preserve exactly as-is
  // These are WhatsApp internal identifiers that must not be modified
  if (phone.includes('@lid') || phone.includes('@s.whatsapp.net') || phone.includes('@c.us')) {
    // Just remove + if present, keep the rest intact
    const result = phone.replace(/^\+/, '');
    console.log(`[formatPhoneNumber] Preserved existing format: "${result}"`);
    return result;
  }
  
  // Remove any non-digit characters for processing
  let cleaned = phone.replace(/\D/g, '');
  
  // Sort country codes by length descending to match longer codes first (e.g., 351 before 35)
  const sortedCodes = [...COUNTRY_CODES].sort((a, b) => b.length - a.length);
  
  // Check if already has a valid country code
  const hasCountryCode = sortedCodes.some(code => cleaned.startsWith(code));
  
  if (!hasCountryCode) {
    // Try to detect format and apply appropriate country code
    
    // Portuguese mobile format: starts with 9, has 9 digits (e.g., 935379572)
    if (/^9\d{8}$/.test(cleaned)) {
      cleaned = '351' + cleaned;
      console.log(`[formatPhoneNumber] Detected Portuguese mobile, added 351`);
    }
    // Portuguese landline format: starts with 2, has 9 digits (e.g., 212345678)
    else if (/^2\d{8}$/.test(cleaned)) {
      cleaned = '351' + cleaned;
      console.log(`[formatPhoneNumber] Detected Portuguese landline, added 351`);
    }
    // Brazilian format: 10-11 digits, DDD + number (e.g., 11999998888)
    else if (/^\d{10,11}$/.test(cleaned) && !cleaned.startsWith('0')) {
      cleaned = '55' + cleaned;
      console.log(`[formatPhoneNumber] Detected Brazilian format, added 55`);
    }
    // Fallback: Don't modify - better to preserve than corrupt
    else {
      console.log(`[formatPhoneNumber] Unknown format, preserving as-is: ${cleaned}`);
    }
  } else {
    console.log(`[formatPhoneNumber] Already has country code`);
  }
  
  const result = cleaned + '@s.whatsapp.net';
  console.log(`[formatPhoneNumber] Output: "${result}"`);
  return result;
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

export async function getInstanceQrCode(instanceName: string): Promise<{ qrText: string } | null> {
  const { apiUrl, apiKey } = getConfig();
  
  console.log(`[evolutionClient] Fetching QR code for ${instanceName}`);
  
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

  const qrData = await response.json();
  console.log(`[evolutionClient] QR code received:`, { 
    hasCode: !!qrData?.code,
    codeLength: qrData?.code?.length 
  });
  
  // Return only the QR text - frontend will generate the image
  return qrData?.code ? { qrText: qrData.code } : null;
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

export async function deleteInstance(instanceName: string): Promise<void> {
  const { apiUrl, apiKey } = getConfig();
  
  console.log(`[evolutionClient] Deleting instance ${instanceName}`);
  
  const response = await fetch(
    `${apiUrl}/instance/delete/${instanceName}`,
    {
      method: 'DELETE',
      headers: getAuthHeaders(apiKey),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[evolutionClient] Instance deletion failed:`, errorText);
    
    // If instance doesn't exist (404), that's fine
    if (response.status === 404) {
      console.log(`[evolutionClient] Instance ${instanceName} not found, skipping deletion`);
      return;
    }
    
    throw new Error(`Evolution API instance deletion failed: ${response.status} - ${errorText}`);
  }
  
  console.log(`[evolutionClient] Instance ${instanceName} deleted successfully`);
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
