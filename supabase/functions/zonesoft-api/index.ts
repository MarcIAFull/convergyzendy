import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ZONESOFT_API_BASE = "https://api.zonesoft.org/v3";

interface ZoneSoftConfig {
  id: string;
  restaurant_id: string;
  enabled: boolean;
  client_id: string | null;
  app_key: string | null;
  app_secret: string | null;
  store_id: number | null;
  warehouse_id: number | null;
  operator_id: number | null;
  document_type: string;
  document_series: string | null;
  payment_type_id: number;
}

interface ZoneSoftAPIResult {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
}

// Generate HMAC-SHA256 signature
// NOTE: ZoneSoft credentials are often provided as HEX strings. Some APIs expect the secret
// to be decoded from HEX into raw bytes before computing HMAC.
function secretToKeyBytes(appSecret: string): Uint8Array {
  const trimmed = appSecret.trim();
  const isHex = /^[0-9a-fA-F]+$/.test(trimmed) && trimmed.length % 2 === 0;
  if (!isHex) {
    return new TextEncoder().encode(trimmed);
  }

  const bytes = new Uint8Array(trimmed.length / 2);
  for (let i = 0; i < trimmed.length; i += 2) {
    bytes[i / 2] = parseInt(trimmed.slice(i, i + 2), 16);
  }
  return bytes;
}

// Encode bytes to base64
function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function generateSignature(body: string, appSecret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = secretToKeyBytes(appSecret);
  const data = encoder.encode(body);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signatureBytes = new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, data));

  // Try both formats and log them for debugging
  const hexLower = Array.from(signatureBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const hexUpper = hexLower.toUpperCase();
  const base64Sig = bytesToBase64(signatureBytes);

  console.log(`[ZoneSoft] Signature formats - hex: ${hexLower.slice(0, 16)}..., base64: ${base64Sig.slice(0, 16)}...`);

  // ZoneSoft API documentation is unclear - try Base64 as some HMAC APIs prefer it
  // If hex doesn't work, Base64 is the common alternative
  return base64Sig;
}

// Make authenticated request to ZoneSoft API
async function zoneSoftRequest(
  config: { client_id: string; app_key: string; app_secret: string },
  interfaceName: string,
  action: string,
  body: Record<string, unknown>
): Promise<ZoneSoftAPIResult> {
  // ZoneSoft API expects compact JSON (no extra spaces)
  const bodyString = JSON.stringify(body);
  const signature = await generateSignature(bodyString, config.app_secret);
  
  const url = `${ZONESOFT_API_BASE}/${interfaceName}/${action}`;
  
  console.log(`[ZoneSoft] Calling ${url}`);
  console.log(`[ZoneSoft] Body: ${bodyString}`);

  const mask = (v: string) => (v.length <= 8 ? "***" : `${v.slice(0, 4)}...${v.slice(-4)}`);
  console.log(`[ZoneSoft] Auth: client_id=${mask(config.client_id)} app_key=${mask(config.app_key)} signature=${mask(signature)}`);
  
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-ZS-CLIENT-ID": config.client_id.trim(),
      "X-ZS-APP-KEY": config.app_key.trim(),
      "X-ZS-SIGNATURE": signature,
    };

    console.log(`[ZoneSoft] Headers sent: ${Object.keys(headers).join(', ')}`);
    
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: bodyString,
    });
    
    const responseText = await response.text();
    console.log(`[ZoneSoft] Response status: ${response.status}`);
    console.log(`[ZoneSoft] Response body: ${responseText}`);
    
    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${responseText}`,
      };
    }
    
    try {
      const data = JSON.parse(responseText);
      return { success: true, data };
    } catch {
      return { success: true, data: { raw: responseText } };
    }
  } catch (error) {
    console.error(`[ZoneSoft] Request error:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Get ZoneSoft config for restaurant
async function getZoneSoftConfig(
  supabase: SupabaseClient,
  restaurantId: string
): Promise<ZoneSoftConfig | null> {
  const { data, error } = await supabase
    .from("restaurant_zonesoft_config")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .single();
  
  if (error || !data) {
    return null;
  }
  
  return data as ZoneSoftConfig;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { action, restaurantId, ...params } = await req.json();
    
    console.log(`[ZoneSoft] Action: ${action}, Restaurant: ${restaurantId}`);
    
    // Actions that don't need config yet
    if (action === "save-config") {
      const { config } = params;
      
      // Upsert config
      const { data, error } = await supabase
        .from("restaurant_zonesoft_config")
        .upsert({
          restaurant_id: restaurantId,
          ...config,
          updated_at: new Date().toISOString(),
        }, { onConflict: "restaurant_id" })
        .select()
        .single();
      
      if (error) {
        throw new Error(`Failed to save config: ${error.message}`);
      }
      
      return new Response(JSON.stringify({ success: true, data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    if (action === "get-config") {
      const config = await getZoneSoftConfig(supabase, restaurantId);
      
      return new Response(JSON.stringify({ success: true, data: config }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    // Actions that do NOT require ZoneSoft API credentials (internal DB only)
    if (!restaurantId) {
      return new Response(JSON.stringify({
        success: false,
        error: "Missing restaurantId",
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get product mappings (should be available even before credentials are configured)
    if (action === "get-mappings") {
      const { data, error } = await supabase
        .from("zonesoft_product_mapping")
        .select("*")
        .eq("restaurant_id", restaurantId);

      if (error) {
        throw new Error(`Failed to get mappings: ${error.message}`);
      }

      return new Response(JSON.stringify({ success: true, data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Save product mapping (doesn't require ZoneSoft credentials)
    if (action === "save-mapping") {
      const {
        localProductId,
        zoneSoftProductId,
        zoneSoftProductCode,
        zoneSoftProductName,
      } = params as {
        localProductId?: string;
        zoneSoftProductId?: number;
        zoneSoftProductCode?: string;
        zoneSoftProductName?: string;
      };

      if (!localProductId || !zoneSoftProductId) {
        return new Response(JSON.stringify({
          success: false,
          error: "Missing localProductId or zoneSoftProductId",
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error } = await supabase
        .from("zonesoft_product_mapping")
        .upsert({
          restaurant_id: restaurantId,
          local_product_id: localProductId,
          zonesoft_product_id: zoneSoftProductId,
          zonesoft_product_code: zoneSoftProductCode,
          zonesoft_product_name: zoneSoftProductName,
          last_synced_at: new Date().toISOString(),
        }, { onConflict: "restaurant_id,local_product_id" });

      if (error) {
        throw new Error(`Failed to save mapping: ${error.message}`);
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get sync logs (doesn't require ZoneSoft credentials)
    if (action === "get-sync-logs") {
      const { orderId, limit = 10 } = params as { orderId?: string; limit?: number };

      let query = supabase
        .from("zonesoft_sync_logs")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (orderId) {
        query = query.eq("order_id", orderId);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Failed to get logs: ${error.message}`);
      }

      return new Response(JSON.stringify({ success: true, data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Actions that need config
    const config = await getZoneSoftConfig(supabase, restaurantId);
    
    if (!config || !config.client_id || !config.app_key || !config.app_secret) {
      return new Response(JSON.stringify({
        success: false,
        error: "ZoneSoft not configured. Please add API credentials.",
        needsConfig: true,
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    const apiConfig = {
      client_id: config.client_id,
      app_key: config.app_key,
      app_secret: config.app_secret,
    };
    
    // Test connection
    if (action === "test-connection") {
      // Try to get products list as a connection test
      const result = await zoneSoftRequest(apiConfig, "products", "getInstances", {
        loja: config.store_id || 1,
        limit: 1,
      });
      
      // Update config with test result
      await supabase
        .from("restaurant_zonesoft_config")
        .update({
          last_sync_at: new Date().toISOString(),
          last_error: result.success ? null : result.error,
        })
        .eq("restaurant_id", restaurantId);
      
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    // Sync products from ZoneSoft
    if (action === "sync-products") {
      const result = await zoneSoftRequest(apiConfig, "products", "getInstances", {
        loja: config.store_id || 1,
        limit: 1000,
      });
      
      if (!result.success) {
        return new Response(JSON.stringify(result), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      // Update products_synced_at
      await supabase
        .from("restaurant_zonesoft_config")
        .update({
          products_synced_at: new Date().toISOString(),
        })
        .eq("restaurant_id", restaurantId);
      
      return new Response(JSON.stringify({
        success: true,
        data: { products: result.data },
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    // Send order to ZoneSoft
    if (action === "send-order") {
      const { orderId } = params;
      
      // Fetch order with items
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .select(`
          *,
          customer:customers(name),
          cart:carts(
            cart_items(
              *,
              product:products(*),
              addons:cart_item_addons(
                addon:addons(*)
              )
            )
          )
        `)
        .eq("id", orderId)
        .single();
      
      if (orderError || !order) {
        throw new Error(`Order not found: ${orderId}`);
      }
      
      // Get product mappings
      const { data: mappings } = await supabase
        .from("zonesoft_product_mapping")
        .select("*")
        .eq("restaurant_id", restaurantId);
      
      const mappingMap = new Map(
        (mappings || []).map((m: { local_product_id: string; zonesoft_product_id: number }) => 
          [m.local_product_id, m]
        )
      );
      
      // Build document lines from cart items
      const vendas: Array<{
        codigo?: number;
        descricao: string;
        qtd: number;
        punit: number;
        iva: number;
        total: number;
        obs?: string;
      }> = [];
      
      // deno-lint-ignore no-explicit-any
      const cartItems = (order as any).cart?.cart_items || [];
      
      // deno-lint-ignore no-explicit-any
      for (const item of cartItems as any[]) {
        const product = item.product;
        const mapping = mappingMap.get(product.id) as { zonesoft_product_id: number } | undefined;
        
        // Main product line
        vendas.push({
          codigo: mapping?.zonesoft_product_id,
          descricao: product.name,
          qtd: item.quantity,
          punit: product.price,
          iva: 23, // Default VAT - should be configurable
          total: product.price * item.quantity,
          obs: item.notes || undefined,
        });
        
        // Add addons as separate lines
        // deno-lint-ignore no-explicit-any
        for (const addonEntry of item.addons || [] as any[]) {
          const addon = addonEntry.addon;
          if (addon) {
            vendas.push({
              descricao: `+ ${addon.name}`,
              qtd: item.quantity,
              punit: addon.price,
              iva: 23,
              total: addon.price * item.quantity,
            });
          }
        }
      }
      
      // Build document
      const now = new Date();
      const document = {
        doc: config.document_type || "TK",
        serie: config.document_series || undefined,
        loja: config.store_id || 1,
        armazem: config.warehouse_id || 1,
        cliente: 0, // Anonymous customer
        // deno-lint-ignore no-explicit-any
        nome: (order as any).customer?.name || "Cliente Web",
        // deno-lint-ignore no-explicit-any
        telefone: (order as any).user_phone,
        // deno-lint-ignore no-explicit-any
        morada: (order as any).delivery_address,
        pagamento: config.payment_type_id || 1,
        emp: config.operator_id || 1,
        data: now.toISOString().split("T")[0],
        datahora: now.toISOString().replace("T", " ").substring(0, 19),
        // deno-lint-ignore no-explicit-any
        observacoes: (order as any).order_notes || `Pedido Web #${orderId.slice(0, 8)}`,
        ivaincluido: 1,
        vendas,
      };
      
      console.log(`[ZoneSoft] Sending document:`, JSON.stringify(document, null, 2));
      
      // Send to ZoneSoft
      const result = await zoneSoftRequest(apiConfig, "documents", "saveInstances", {
        document: [document],
      });
      
      // Extract document info from result
      const documentData = result.data?.document as Array<{ numero?: number; serie?: string; doc?: string }> | undefined;
      const firstDoc = documentData?.[0];
      
      // Log the sync attempt
      await supabase.from("zonesoft_sync_logs").insert({
        restaurant_id: restaurantId,
        order_id: orderId,
        action: "send_order",
        status: result.success ? "success" : "error",
        zonesoft_document_number: firstDoc?.numero || null,
        zonesoft_document_type: config.document_type,
        zonesoft_document_series: config.document_series,
        request_body: document,
        response_body: result.data || { error: result.error },
        error_message: result.success ? null : result.error,
      });
      
      // Update order if successful
      if (result.success && firstDoc) {
        await supabase
          .from("orders")
          .update({
            zonesoft_document_number: firstDoc.numero,
            zonesoft_document_type: firstDoc.doc,
            zonesoft_document_series: firstDoc.serie,
            zonesoft_synced_at: new Date().toISOString(),
          })
          .eq("id", orderId);
      }
      
      return new Response(JSON.stringify({
        success: result.success,
        data: result.success ? { document: documentData } : undefined,
        error: result.error,
      }), {
        status: result.success ? 200 : 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    // Get sync logs
    if (action === "get-sync-logs") {
      const { orderId, limit = 10 } = params;
      
      let query = supabase
        .from("zonesoft_sync_logs")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("created_at", { ascending: false })
        .limit(limit);
      
      if (orderId) {
        query = query.eq("order_id", orderId);
      }
      
      const { data, error } = await query;
      
      if (error) {
        throw new Error(`Failed to get logs: ${error.message}`);
      }
      
      return new Response(JSON.stringify({ success: true, data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    // Save product mapping
    if (action === "save-mapping") {
      const { localProductId, zoneSoftProductId, zoneSoftProductCode, zoneSoftProductName } = params;
      
      const { error } = await supabase
        .from("zonesoft_product_mapping")
        .upsert({
          restaurant_id: restaurantId,
          local_product_id: localProductId,
          zonesoft_product_id: zoneSoftProductId,
          zonesoft_product_code: zoneSoftProductCode,
          zonesoft_product_name: zoneSoftProductName,
          last_synced_at: new Date().toISOString(),
        }, { onConflict: "restaurant_id,local_product_id" });
      
      if (error) {
        throw new Error(`Failed to save mapping: ${error.message}`);
      }
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    // Get product mappings
    if (action === "get-mappings") {
      const { data, error } = await supabase
        .from("zonesoft_product_mapping")
        .select("*")
        .eq("restaurant_id", restaurantId);
      
      if (error) {
        throw new Error(`Failed to get mappings: ${error.message}`);
      }
      
      return new Response(JSON.stringify({ success: true, data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    return new Response(JSON.stringify({
      success: false,
      error: `Unknown action: ${action}`,
    }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
    
  } catch (error) {
    console.error("[ZoneSoft] Error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "Internal server error",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
