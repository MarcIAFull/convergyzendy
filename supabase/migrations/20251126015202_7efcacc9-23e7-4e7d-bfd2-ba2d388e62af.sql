-- ============================================================
-- SEED DATA: Pizzaria A Família
-- Dados de exemplo completos para teste do sistema
-- ============================================================

-- Primeiro, limpar dados anteriores se necessário
-- (Comentar se quiser preservar dados existentes)
-- DELETE FROM cart_items WHERE cart_id IN (SELECT id FROM carts WHERE restaurant_id = 'seu_restaurant_id');
-- DELETE FROM products WHERE restaurant_id = 'seu_restaurant_id';
-- DELETE FROM categories WHERE restaurant_id = 'seu_restaurant_id';

-- ============================================================
-- CRIAR CATEGORIAS
-- ============================================================

INSERT INTO categories (restaurant_id, name, sort_order) 
SELECT 
  r.id,
  category_name,
  category_order
FROM restaurants r
CROSS JOIN (
  VALUES 
    ('Entradas', 10),
    ('Salgados Brasileiros', 20),
    ('Enrolados', 30),
    ('Pizzas Salgadas', 40),
    ('Pizzas Doces', 50),
    ('Esfihas Salgadas', 60),
    ('Esfihas Doces', 70),
    ('Hambúrgueres', 80),
    ('Porções', 90),
    ('Menu Kids', 100),
    ('Açaí', 110),
    ('Bebidas', 120)
) AS cats(category_name, category_order)
WHERE r.name = 'A Família'
ON CONFLICT DO NOTHING;

-- ============================================================
-- PRODUTOS: ENTRADAS
-- ============================================================

INSERT INTO products (restaurant_id, category_id, name, description, price, is_available, is_featured)
SELECT 
  r.id,
  c.id,
  'Pão de Alho',
  'Pão tradicional com manteiga de alho, assado até ficar dourado e crocante | Serve: 2-3 pessoas | Perfil: Crocante, aromático | Popularidade: Alta',
  7.50,
  true,
  false
FROM restaurants r
JOIN categories c ON c.restaurant_id = r.id AND c.name = 'Entradas'
WHERE r.name = 'A Família';

-- ============================================================
-- PRODUTOS: SALGADOS BRASILEIROS
-- ============================================================

INSERT INTO products (restaurant_id, category_id, name, description, price, is_available, is_featured)
SELECT 
  r.id,
  c.id,
  prod_name,
  prod_desc,
  prod_price,
  true,
  false
FROM restaurants r
JOIN categories c ON c.restaurant_id = r.id AND c.name = 'Salgados Brasileiros'
CROSS JOIN (
  VALUES 
    ('Salgados Brasileiros - Porção Inteira', 'Kibe, Coxinha e Bolinha de Queijo (10 unidades) - Pode escolher apenas uma qualidade ou misto | Serve: 3-4 pessoas | Perfil: Tradicional brasileiro | Popularidade: Alta', 11.00),
    ('Salgados Brasileiros - Meia Porção', 'Kibe, Coxinha e Bolinha de Queijo (5 unidades) - Pode escolher apenas uma qualidade ou misto | Serve: 1-2 pessoas | Perfil: Tradicional brasileiro | Popularidade: Média', 6.00)
) AS prods(prod_name, prod_desc, prod_price)
WHERE r.name = 'A Família';

-- ============================================================
-- PRODUTOS: ENROLADOS
-- ============================================================

INSERT INTO products (restaurant_id, category_id, name, description, price, is_available, is_featured)
SELECT 
  r.id,
  c.id,
  prod_name,
  prod_desc,
  8.00,
  true,
  false
FROM restaurants r
JOIN categories c ON c.restaurant_id = r.id AND c.name = 'Enrolados'
CROSS JOIN (
  VALUES 
    ('Enrolado de Queijo e Fiambre', 'Queijo mozzarella e fiambre (12 unidades) | Serve: 2-3 pessoas | Perfil: Clássico | Popularidade: Alta'),
    ('Enrolado de Calabresa com Cebola', 'Calabresa brasileira com cebola caramelizada (12 unidades) | Serve: 2-3 pessoas | Perfil: Picante suave | Popularidade: Média'),
    ('Enrolado de Frango com Catupiry', 'Frango desfiado com catupiry cremoso (12 unidades) | Serve: 2-3 pessoas | Perfil: Cremoso | Popularidade: Alta')
) AS prods(prod_name, prod_desc)
WHERE r.name = 'A Família';

-- ============================================================
-- PRODUTOS: PIZZAS SALGADAS (Tamanho 4 Pedaços)
-- ============================================================

INSERT INTO products (restaurant_id, category_id, name, description, price, is_available, is_featured)
SELECT 
  r.id,
  c.id,
  prod_name || ' - 4 Pedaços',
  prod_desc || ' | Serve: 1 pessoa',
  11.00,
  true,
  prod_featured
FROM restaurants r
JOIN categories c ON c.restaurant_id = r.id AND c.name = 'Pizzas Salgadas'
CROSS JOIN (
  VALUES 
    ('Pizza A Família', 'Molho de tomate, mozzarella, calabresa, frango, barbecue, catupiry, azeitonas | Perfil: Completo, harmonioso | Popularidade: MÁXIMA', true),
    ('Pizza Margherita', 'Molho de tomate, mozzarella e orégãos | Perfil: Simples e tradicional | Popularidade: Alta', false),
    ('Pizza 4 Queijos', 'Molho de tomate, mozzarella, emmental, cheddar, catupiry | Perfil: Cremoso, forte | Popularidade: Muito Alta', true),
    ('Pizza Portuguesa', 'Molho de tomate, mozzarella, azeitona, tomate, ovo, milho, ervilha, fiambre, cebola | Perfil: Completo, tradicional | Popularidade: Muito Alta', false),
    ('Pizza Calabresa', 'Molho de tomate, mozzarella, calabresa, cebola | Perfil: Tradicional brasileiro | Popularidade: Muito Alta', false),
    ('Pizza Frango com Catupiry', 'Molho de tomate, mozzarella, frango, catupiry | Perfil: Cremoso, suave | Popularidade: Muito Alta', false)
) AS prods(prod_name, prod_desc, prod_featured)
WHERE r.name = 'A Família';

-- ============================================================
-- PRODUTOS: PIZZAS SALGADAS (Tamanho 6 Pedaços)
-- ============================================================

INSERT INTO products (restaurant_id, category_id, name, description, price, is_available, is_featured)
SELECT 
  r.id,
  c.id,
  prod_name || ' - 6 Pedaços',
  prod_desc || ' | Serve: 1-2 pessoas | Nota: Aceita até 2 sabores diferentes',
  15.90,
  true,
  prod_featured
FROM restaurants r
JOIN categories c ON c.restaurant_id = r.id AND c.name = 'Pizzas Salgadas'
CROSS JOIN (
  VALUES 
    ('Pizza A Família', 'Molho de tomate, mozzarella, calabresa, frango, barbecue, catupiry, azeitonas | Perfil: Completo, harmonioso | Popularidade: MÁXIMA', true),
    ('Pizza Margherita', 'Molho de tomate, mozzarella e orégãos | Perfil: Simples e tradicional | Popularidade: Alta', false),
    ('Pizza 4 Queijos', 'Molho de tomate, mozzarella, emmental, cheddar, catupiry | Perfil: Cremoso, forte | Popularidade: Muito Alta', true),
    ('Pizza Portuguesa', 'Molho de tomate, mozzarella, azeitona, tomate, ovo, milho, ervilha, fiambre, cebola | Perfil: Completo, tradicional | Popularidade: Muito Alta', false),
    ('Pizza Calabresa', 'Molho de tomate, mozzarella, calabresa, cebola | Perfil: Tradicional brasileiro | Popularidade: Muito Alta', false),
    ('Pizza Frango com Catupiry', 'Molho de tomate, mozzarella, frango, catupiry | Perfil: Cremoso, suave | Popularidade: Muito Alta', false)
) AS prods(prod_name, prod_desc, prod_featured)
WHERE r.name = 'A Família';

-- ============================================================
-- PRODUTOS: PIZZAS SALGADAS (Tamanho 8 Pedaços)
-- ============================================================

INSERT INTO products (restaurant_id, category_id, name, description, price, is_available, is_featured)
SELECT 
  r.id,
  c.id,
  prod_name || ' - 8 Pedaços',
  prod_desc || ' | Serve: 2-3 pessoas | Nota: Aceita até 3 sabores diferentes',
  18.90,
  true,
  prod_featured
FROM restaurants r
JOIN categories c ON c.restaurant_id = r.id AND c.name = 'Pizzas Salgadas'
CROSS JOIN (
  VALUES 
    ('Pizza A Família', 'Molho de tomate, mozzarella, calabresa, frango, barbecue, catupiry, azeitonas | Perfil: Completo, harmonioso | Popularidade: MÁXIMA', true),
    ('Pizza Margherita', 'Molho de tomate, mozzarella e orégãos | Perfil: Simples e tradicional | Popularidade: Alta', false),
    ('Pizza 4 Queijos', 'Molho de tomate, mozzarella, emmental, cheddar, catupiry | Perfil: Cremoso, forte | Popularidade: Muito Alta', true),
    ('Pizza Portuguesa', 'Molho de tomate, mozzarella, azeitona, tomate, ovo, milho, ervilha, fiambre, cebola | Perfil: Completo, tradicional | Popularidade: Muito Alta', false),
    ('Pizza Calabresa', 'Molho de tomate, mozzarella, calabresa, cebola | Perfil: Tradicional brasileiro | Popularidade: Muito Alta', false),
    ('Pizza Frango com Catupiry', 'Molho de tomate, mozzarella, frango, catupiry | Perfil: Cremoso, suave | Popularidade: Muito Alta', false),
    ('Pizza Havaiana', 'Molho de tomate, mozzarella, ananás, fiambre | Perfil: Doce e salgado | Popularidade: Alta', false),
    ('Pizza Vegetariana', 'Molho de tomate, mozzarella, azeitonas, cogumelos, pimentos | Perfil: Leve, fresco | Popularidade: Média', false)
) AS prods(prod_name, prod_desc, prod_featured)
WHERE r.name = 'A Família';

-- ============================================================
-- ADDONS: BORDAS PARA PIZZAS
-- ============================================================

-- Criar addons para cada produto de pizza (todas as pizzas podem ter bordas)
INSERT INTO addons (product_id, name, price)
SELECT 
  p.id,
  addon_name,
  addon_price
FROM products p
CROSS JOIN (
  VALUES 
    ('Borda Recheada (Mozzarella ou Catupiry)', 3.50),
    ('Borda Vulcão (Queijo transbordando)', 5.00),
    ('Borda 4 Queijos', 5.00),
    ('Borda Suprema (Queijo + Proteína)', 6.00),
    ('Borda Apózinho (Mini pães com queijo e salsicha)', 5.00)
) AS addons(addon_name, addon_price)
WHERE p.name LIKE 'Pizza%'
AND p.restaurant_id = (SELECT id FROM restaurants WHERE name = 'A Família' LIMIT 1);

-- ============================================================
-- PRODUTOS: HAMBÚRGUERES
-- ============================================================

INSERT INTO products (restaurant_id, category_id, name, description, price, is_available, is_featured)
SELECT 
  r.id,
  c.id,
  prod_name,
  prod_desc,
  prod_price,
  true,
  prod_featured
FROM restaurants r
JOIN categories c ON c.restaurant_id = r.id AND c.name = 'Hambúrgueres'
CROSS JOIN (
  VALUES 
    ('Hambúrguer Algarve', 'Carne bovina (180g), queijo, alface, tomate, cebola roxa, molho especial + Batatas Fritas | Serve: 1 pessoa | Perfil: Premium regional | Popularidade: Alta', 15.90, false),
    ('Hambúrguer Vilamoura', 'Carne bovina (180g), cheddar, bacon, molho barbecue + Batatas Fritas | Serve: 1 pessoa | Perfil: Americano clássico | Popularidade: Alta', 12.90, false),
    ('Hambúrguer Brasil', 'Carne bovina (180g), catupiry, bacon, ovo, batata palha + Batatas Fritas | Serve: 1 pessoa | Perfil: Brasileiro completo | Popularidade: Muito Alta', 13.90, true),
    ('Hambúrguer Júpiter', '5 carnes (900g), 5 queijos, bacon, ovo, saladas, molhos + Batatas Fritas | Serve: 5-6 pessoas | Perfil: Desafio gigante | Popularidade: Alta', 45.90, true)
) AS prods(prod_name, prod_desc, prod_price, prod_featured)
WHERE r.name = 'A Família';

-- ============================================================
-- PRODUTOS: AÇAÍ
-- ============================================================

INSERT INTO products (restaurant_id, category_id, name, description, price, is_available, is_featured)
SELECT 
  r.id,
  c.id,
  prod_name,
  prod_desc,
  prod_price,
  true,
  false
FROM restaurants r
JOIN categories c ON c.restaurant_id = r.id AND c.name = 'Açaí'
CROSS JOIN (
  VALUES 
    ('Açaí Pequeno', 'Açaí cremoso 300ml - Escolha 5 complementos incluídos | Serve: 1 pessoa | Perfil: Tropical | Popularidade: Alta', 6.00),
    ('Açaí Médio', 'Açaí cremoso 500ml - Escolha 7 complementos incluídos | Serve: 1-2 pessoas | Perfil: Tropical | Popularidade: Muito Alta', 11.00),
    ('Açaí Grande', 'Açaí cremoso 700ml - Escolha 7 complementos incluídos | Serve: 2-3 pessoas | Perfil: Tropical | Popularidade: Alta', 16.00)
) AS prods(prod_name, prod_desc, prod_price)
WHERE r.name = 'A Família';

-- ============================================================
-- ADDONS: COMPLEMENTOS PARA AÇAÍ
-- ============================================================

INSERT INTO addons (product_id, name, price)
SELECT 
  p.id,
  addon_name,
  1.00 -- Cada complemento extra custa €1,00
FROM products p
CROSS JOIN (
  VALUES 
    ('Leite em pó'),
    ('M&Ms'),
    ('Paçoca brasileira'),
    ('Granola crocante'),
    ('Banana'),
    ('Morango'),
    ('Kiwi'),
    ('Doce de leite'),
    ('Leite condensado'),
    ('Calda de morango'),
    ('Calda de chocolate'),
    ('Creme de cacau')
) AS addons(addon_name)
WHERE p.name LIKE 'Açaí%'
AND p.restaurant_id = (SELECT id FROM restaurants WHERE name = 'A Família' LIMIT 1);

-- ============================================================
-- CONFIGURAR AI SETTINGS DO RESTAURANTE
-- ============================================================

INSERT INTO restaurant_ai_settings (
  restaurant_id,
  tone,
  greeting_message,
  closing_message,
  upsell_aggressiveness,
  max_additional_questions_before_checkout,
  language,
  business_rules,
  faq_responses,
  special_offers_info,
  unavailable_items_handling,
  custom_instructions
)
SELECT 
  r.id,
  'friendly',
  'Olá! 👋 Bem-vindo à Pizzaria A Família! Somos especialistas em pizzas brasileiras e portuguesas. O que vai ser hoje?',
  'Obrigado pela preferência! 🍕 Bom apetite e até à próxima!',
  'medium',
  2,
  'pt-PT',
  
  -- BUSINESS RULES
  E'HORÁRIO DE FUNCIONAMENTO:
- Terça a Domingo: 18h00 - 23h00
- Último pedido: 22h30
- Segunda-feira: FECHADO

FORMAS DE PAGAMENTO:
- MB Way: 915 817 565 (mesmo preço de todos os métodos)
- Multibanco (referência após pedido)
- Cartão na entrega
- Dinheiro (troco limitado)
IMPORTANTE: TODOS os métodos têm o mesmo preço final, SEM descontos

TAXAS DE ENTREGA (por distância):
- Até 2km: €3,00
- 2-3.5km: €3,50
- 3.5-4.5km: €4,00
- 4.5-5.5km: €5,00
- 5.5-7km: €6,00
- 7-9km: €7,00
- 9-10km: €9,00
- Até 15km (consultar)
- Embalagem obrigatória: €0,34

TEMPO DE PREPARO:
- Retirada (Pickup): 20-30 minutos (SEM taxa, SEM embalagem)
- Entrega (Delivery): 30-60 minutos (com taxa conforme distância)

DIVISÃO DE SABORES:
- Pizza 4 pedaços: 1 sabor apenas
- Pizza 6 pedaços: até 2 sabores
- Pizza 8 pedaços: até 3 sabores
- Pizza Maracanã (16 pedaços): até 4 sabores
- Pizza Golias (38 pedaços): até 6 sabores',

  -- FAQ RESPONSES
  E'P: Qual pizza é mais pedida?
R: A Pizza A Família é a nossa campeã! 🏆 Calabresa, frango, barbecue e catupiry numa combinação perfeita.

P: Fazem pizza meio a meio?
R: Sim! Pizza de 6 pedaços aceita 2 sabores, de 8 pedaços aceita até 3 sabores diferentes!

P: Qual o tempo de entrega?
R: Entrega: 30-60 minutos (depende da distância). Retirada no local: 20-30 minutos!

P: Aceitam MB Way?
R: Sim! Número: 915 817 565. Todos os métodos de pagamento têm o mesmo preço.

P: Têm opções vegetarianas?
R: Temos a Pizza Vegetariana com cogumelos, pimentos e azeitonas! 🥗

P: Qual o pedido mínimo?
R: Não há pedido mínimo! Apenas a embalagem obrigatória de €0,34 para entregas.

P: Posso adicionar borda recheada?
R: Sim! Temos 5 tipos de bordas: Recheada (€3,50), Vulcão (€5), 4 Queijos (€5), Suprema (€6) e Apózinho (€5).

P: Fazem entrega onde?
R: Entregamos até 15km de distância. A taxa varia de €3 a €14 conforme a localização.',

  -- SPECIAL OFFERS
  E'🎉 PROMOÇÕES ATIVAS:
- Pizza Maracanã (16 pedaços, até 4 sabores) com borda normal: €40,00
- Pizza Golias (38 pedaços, até 6 sabores): €55,00 - Perfeita para festas!
- Hambúrguer Júpiter (900g, 5 carnes): €45,90 - Desafio para grupos!

💡 DICA: Para pizzas grandes, pergunte sempre se querem adicionar borda recheada!',

  -- UNAVAILABLE ITEMS HANDLING
  E'Se um item não estiver disponível:
1. Pedir desculpas pelo incómodo
2. Sugerir alternativa similar da mesma categoria
3. Se for pizza, sugerir outro sabor popular como A Família ou 4 Queijos
4. Sempre oferecer ajuda para encontrar algo que goste',

  -- CUSTOM INSTRUCTIONS
  E'COMPORTAMENTO ESPECÍFICO:
- A Pizza "A Família" é o nosso produto estrela - mencionar quando relevante
- Para pizzas grandes (8 pedaços ou mais), sempre perguntar sobre borda recheada
- Para açaí, lembrar que complementos são INCLUÍDOS no preço (5 no pequeno, 7 no médio/grande)
- Usar expressões portuguesas: "fixe", "impecável", "está feito", "bom apetite"
- Ser caloroso mas profissional - somos uma pizzaria familiar
- NUNCA mencionar descontos por forma de pagamento - todos custam o mesmo
- Sempre confirmar o endereço de entrega antes de finalizar
- Se cliente mencionar distância >15km, informar que não entregamos tão longe

UPSELL INTELIGENTE:
- Cliente pede pizza 4 pedaços? Sugerir 6 ou 8 para compartilhar
- Cliente pede hambúrguer? Mencionar que já inclui batatas fritas
- Cliente pede açaí? Lembrar dos complementos incluídos
- Cliente pede para retirar? Mencionar que não paga taxa nem embalagem'

FROM restaurants r
WHERE r.name = 'A Família'
ON CONFLICT (restaurant_id) 
DO UPDATE SET
  tone = EXCLUDED.tone,
  greeting_message = EXCLUDED.greeting_message,
  closing_message = EXCLUDED.closing_message,
  upsell_aggressiveness = EXCLUDED.upsell_aggressiveness,
  max_additional_questions_before_checkout = EXCLUDED.max_additional_questions_before_checkout,
  language = EXCLUDED.language,
  business_rules = EXCLUDED.business_rules,
  faq_responses = EXCLUDED.faq_responses,
  special_offers_info = EXCLUDED.special_offers_info,
  unavailable_items_handling = EXCLUDED.unavailable_items_handling,
  custom_instructions = EXCLUDED.custom_instructions;