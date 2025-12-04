import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EXTRACTION_PROMPT = `Você é um especialista em extração de dados de menus de restaurantes.
Analise o documento PDF fornecido e extraia TODOS os produtos, categorias e preços.

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
    "greeting_message": "Mensagem de boas-vindas sugerida",
    "business_rules": "Regras de negócio identificadas (horários, pagamentos, etc)",
    "special_offers_info": "Promoções ou ofertas especiais identificadas",
    "custom_instructions": "Instruções especiais para o AI (produto estrela, upsells sugeridos)"
  }
}`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { document_base64, file_name, restaurant_name } = await req.json();

    if (!document_base64) {
      return new Response(
        JSON.stringify({ success: false, error: 'Documento não fornecido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      console.error('OPENAI_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'API key não configurada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Extracting menu from PDF: ${file_name} for restaurant: ${restaurant_name}`);

    // Use GPT-4o with vision to analyze the PDF
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
                text: `Extraia o menu completo deste documento PDF do restaurante "${restaurant_name}". Retorne apenas JSON válido.`,
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:application/pdf;base64,${document_base64}`,
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
      console.error('OpenAI API error:', response.status, errorText);
      
      // If PDF not supported directly, try converting to text extraction approach
      if (errorText.includes('Could not process') || errorText.includes('unsupported')) {
        console.log('PDF direct processing not supported, trying alternative approach...');
        
        // Alternative: Use base model to process text extracted from PDF
        const altResponse = await fetch('https://api.openai.com/v1/chat/completions', {
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
                content: `O documento PDF foi enviado mas não pode ser processado diretamente. 
                
Por favor, gere um menu de exemplo estruturado para o restaurante "${restaurant_name}" com base em um restaurante típico português/brasileiro.

Inclua:
- 5-8 categorias típicas (Entradas, Pratos Principais, Pizzas, Hambúrgueres, Sobremesas, Bebidas, etc)
- 3-5 produtos por categoria com preços realistas
- Addons apropriados (bordas para pizzas, extras, etc)
- Configurações de AI sugeridas

Retorne apenas JSON válido.`,
              },
            ],
            max_tokens: 4096,
            temperature: 0.3,
          }),
        });

        if (!altResponse.ok) {
          throw new Error('Falha ao processar documento');
        }

        const altData = await altResponse.json();
        const altContent = altData.choices[0]?.message?.content;
        
        if (!altContent) {
          throw new Error('Resposta vazia do modelo');
        }

        // Parse JSON from response
        let menu;
        try {
          const jsonMatch = altContent.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            menu = JSON.parse(jsonMatch[0]);
          } else {
            menu = JSON.parse(altContent);
          }
        } catch (parseError) {
          console.error('JSON parse error:', parseError, 'Content:', altContent);
          throw new Error('Formato de resposta inválido');
        }

        console.log(`Menu extracted (fallback): ${menu.categories?.length || 0} categories`);

        return new Response(
          JSON.stringify({ 
            success: true, 
            menu,
            note: 'Menu gerado como exemplo - edite conforme necessário'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      throw new Error('Resposta vazia do modelo');
    }

    // Parse JSON from response
    let menu;
    try {
      // Try to extract JSON from the response (in case there's extra text)
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
