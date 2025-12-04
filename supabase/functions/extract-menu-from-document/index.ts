import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EXTRACTION_PROMPT = `Você é um especialista em extração de dados de menus de restaurantes.
Analise o documento do menu e extraia TODOS os produtos, categorias e preços visíveis.

REGRAS IMPORTANTES:
1. Extraia TODAS as categorias encontradas no menu
2. Para cada produto, extraia: nome, descrição (se houver), preço
3. Identifique addons/complementos que se aplicam a produtos específicos (ex: bordas para pizzas, tamanhos, extras)
4. Use preços em formato numérico (ex: 12.50, não "12,50€")
5. Se houver variações de tamanho, crie produtos separados (ex: "Pizza Margherita - Média", "Pizza Margherita - Grande")
6. Marque como is_featured: true os produtos que parecem ser destaques ou mais vendidos

IMPORTANTE: Retorne APENAS o JSON válido, sem markdown, sem explicações.

Formato de resposta JSON:
{
  "categories": [
    {
      "name": "Nome da Categoria",
      "sort_order": 10,
      "products": [
        {
          "name": "Nome do Produto",
          "description": "Descrição detalhada com ingredientes",
          "price": 12.50,
          "is_featured": false,
          "addons": [
            {"name": "Extra queijo", "price": 2.00}
          ]
        }
      ]
    }
  ],
  "ai_settings": {
    "greeting_message": "Mensagem de boas-vindas sugerida baseada no estilo do restaurante",
    "business_rules": "Regras de negócio identificadas (horários, pagamentos, etc)",
    "special_offers_info": "Promoções ou ofertas especiais identificadas",
    "custom_instructions": "Instruções especiais para o AI (produto estrela, upsells sugeridos)"
  }
}`;

async function extractFromImage(document_base64: string, file_type: string, restaurant_name: string): Promise<any> {
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiApiKey) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  let mimeType = file_type || 'image/png';
  if (!mimeType.startsWith('image/')) {
    mimeType = 'image/png';
  }

  console.log(`[Image] Extracting menu from image for restaurant: ${restaurant_name}`);

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: EXTRACTION_PROMPT,
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Extraia o menu completo desta imagem do restaurante "${restaurant_name}". Retorne apenas JSON válido.`,
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${document_base64}`,
              },
            },
          ],
        },
      ],
      max_tokens: 4096,
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[Image] OpenAI API error:', response.status, errorText);
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content;
}

async function extractFromPDF(document_base64: string, file_name: string, restaurant_name: string): Promise<any> {
  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!lovableApiKey) {
    throw new Error('LOVABLE_API_KEY not configured');
  }

  console.log(`[PDF] Extracting menu from PDF: ${file_name} for restaurant: ${restaurant_name}`);

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${lovableApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `${EXTRACTION_PROMPT}\n\nExtraia o menu completo deste PDF do restaurante "${restaurant_name}". Retorne apenas JSON válido.`,
            },
            {
              type: 'file',
              file: {
                filename: file_name || 'menu.pdf',
                data: document_base64,
              },
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[PDF] Lovable AI error:', response.status, errorText);
    throw new Error(`Lovable AI error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { document_base64, file_name, file_type, restaurant_name } = await req.json();

    if (!document_base64) {
      return new Response(
        JSON.stringify({ success: false, error: 'Documento não fornecido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const isPDF = file_type === 'application/pdf';
    console.log(`Processing ${isPDF ? 'PDF' : 'Image'}: ${file_name} (${file_type})`);

    let content: string;
    
    if (isPDF) {
      content = await extractFromPDF(document_base64, file_name, restaurant_name);
    } else {
      content = await extractFromImage(document_base64, file_type, restaurant_name);
    }

    if (!content) {
      throw new Error('Resposta vazia do modelo');
    }

    // Parse JSON from response
    let menu;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        menu = JSON.parse(jsonMatch[0]);
      } else {
        menu = JSON.parse(content);
      }
    } catch (parseError) {
      console.error('JSON parse error:', parseError, 'Content:', content);
      throw new Error('Formato de resposta inválido');
    }

    console.log(`Menu extracted successfully: ${menu.categories?.length || 0} categories`);

    return new Response(
      JSON.stringify({ success: true, menu }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in extract-menu-from-document:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro ao processar documento';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
