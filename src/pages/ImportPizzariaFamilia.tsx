import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useRestaurantStore } from '@/stores/restaurantStore';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, CheckCircle, XCircle, Pizza } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function ImportPizzariaFamilia() {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  const { createRestaurant, restaurant } = useRestaurantStore();
  const navigate = useNavigate();

  const importData = async () => {
    setLoading(true);
    setError(null);
    setSuccess(false);
    setProgress(0);

    try {
      // 1. Criar restaurante
      setStatus('Criando restaurante...');
      await createRestaurant({
        name: 'A Família',
        phone: '915817565',
        address: 'Algarve, Portugal',
        delivery_fee: 3.00,
        is_open: true,
        opening_hours: {
          monday: { open: '', close: '', closed: true },
          tuesday: { open: '18:00', close: '23:00' },
          wednesday: { open: '18:00', close: '23:00' },
          thursday: { open: '18:00', close: '23:00' },
          friday: { open: '18:00', close: '23:00' },
          saturday: { open: '18:00', close: '23:00' },
          sunday: { open: '18:00', close: '23:00' },
        },
      });

      // Aguardar o restaurant ser setado no state
      await new Promise(resolve => setTimeout(resolve, 500));
      
      if (!restaurant) throw new Error('Falha ao criar restaurante');
      const restaurantId = restaurant.id;
      setProgress(10);

      // 2. Criar settings do menu público
      setStatus('Configurando menu público...');
      await supabase.from('restaurant_settings').insert({
        restaurant_id: restaurantId,
        slug: 'a-familia',
        menu_enabled: true,
        checkout_web_enabled: true,
        checkout_whatsapp_enabled: true,
      });
      setProgress(20);

      // 3. Criar categorias
      setStatus('Criando categorias...');
      const categories = [
        { name: 'Entradas', sort_order: 10 },
        { name: 'Salgados Brasileiros', sort_order: 20 },
        { name: 'Enrolados', sort_order: 30 },
        { name: 'Pizzas Salgadas', sort_order: 40 },
        { name: 'Pizzas Doces', sort_order: 50 },
        { name: 'Hambúrgueres', sort_order: 60 },
        { name: 'Açaí', sort_order: 70 },
        { name: 'Bebidas', sort_order: 80 },
      ];

      const { data: createdCategories } = await supabase
        .from('categories')
        .insert(categories.map(c => ({ ...c, restaurant_id: restaurantId })))
        .select();

      if (!createdCategories) throw new Error('Falha ao criar categorias');
      setProgress(30);

      // 4. Criar produtos por categoria
      setStatus('Criando produtos...');
      const categoryMap = Object.fromEntries(createdCategories.map(c => [c.name, c.id]));

      const products = [
        // Entradas
        {
          category_id: categoryMap['Entradas'],
          name: 'Pão de Alho',
          description: 'Pão tradicional com manteiga de alho, assado até ficar dourado e crocante | Serve: 2-3 pessoas | Perfil: Crocante, aromático | Popularidade: Alta',
          price: 7.50,
          is_featured: false,
        },
        // Pizzas 4 Pedaços
        {
          category_id: categoryMap['Pizzas Salgadas'],
          name: 'Pizza A Família - 4 Pedaços',
          description: 'Molho de tomate, mozzarella, calabresa, frango, barbecue, catupiry, azeitonas | Serve: 1 pessoa | Perfil: Completo, harmonioso | Popularidade: MÁXIMA',
          price: 11.00,
          is_featured: true,
        },
        {
          category_id: categoryMap['Pizzas Salgadas'],
          name: 'Pizza 4 Queijos - 4 Pedaços',
          description: 'Molho de tomate, mozzarella, emmental, cheddar, catupiry | Serve: 1 pessoa | Perfil: Cremoso, forte | Popularidade: Muito Alta',
          price: 11.00,
          is_featured: true,
        },
        {
          category_id: categoryMap['Pizzas Salgadas'],
          name: 'Pizza Margherita - 4 Pedaços',
          description: 'Molho de tomate, mozzarella e orégãos | Serve: 1 pessoa | Perfil: Simples e tradicional | Popularidade: Alta',
          price: 11.00,
          is_featured: false,
        },
        // Pizzas 6 Pedaços
        {
          category_id: categoryMap['Pizzas Salgadas'],
          name: 'Pizza A Família - 6 Pedaços',
          description: 'Molho de tomate, mozzarella, calabresa, frango, barbecue, catupiry, azeitonas | Serve: 1-2 pessoas | Nota: Aceita até 2 sabores | Perfil: Completo | Popularidade: MÁXIMA',
          price: 15.90,
          is_featured: true,
        },
        {
          category_id: categoryMap['Pizzas Salgadas'],
          name: 'Pizza 4 Queijos - 6 Pedaços',
          description: 'Molho de tomate, mozzarella, emmental, cheddar, catupiry | Serve: 1-2 pessoas | Nota: Aceita até 2 sabores | Perfil: Cremoso | Popularidade: Muito Alta',
          price: 15.90,
          is_featured: true,
        },
        // Pizzas 8 Pedaços
        {
          category_id: categoryMap['Pizzas Salgadas'],
          name: 'Pizza A Família - 8 Pedaços',
          description: 'Molho de tomate, mozzarella, calabresa, frango, barbecue, catupiry, azeitonas | Serve: 2-3 pessoas | Nota: Aceita até 3 sabores | Perfil: Completo | Popularidade: MÁXIMA',
          price: 18.90,
          is_featured: true,
        },
        {
          category_id: categoryMap['Pizzas Salgadas'],
          name: 'Pizza 4 Queijos - 8 Pedaços',
          description: 'Molho de tomate, mozzarella, emmental, cheddar, catupiry | Serve: 2-3 pessoas | Nota: Aceita até 3 sabores | Perfil: Cremoso | Popularidade: Muito Alta',
          price: 18.90,
          is_featured: true,
        },
        // Hambúrgueres
        {
          category_id: categoryMap['Hambúrgueres'],
          name: 'Hambúrguer Brasil',
          description: 'Carne bovina (180g), catupiry, bacon, ovo, batata palha + Batatas Fritas INCLUÍDAS | Serve: 1 pessoa | Perfil: Brasileiro completo | Popularidade: Muito Alta',
          price: 13.90,
          is_featured: true,
        },
        // Açaí
        {
          category_id: categoryMap['Açaí'],
          name: 'Açaí Médio',
          description: 'Açaí cremoso 500ml - Escolha 7 complementos INCLUÍDOS | Serve: 1-2 pessoas | Perfil: Tropical | Popularidade: Muito Alta',
          price: 11.00,
          is_featured: true,
        },
      ];

      const { data: createdProducts } = await supabase
        .from('products')
        .insert(products.map(p => ({ ...p, restaurant_id: restaurantId, is_available: true })))
        .select();

      if (!createdProducts) throw new Error('Falha ao criar produtos');
      setProgress(60);

      // 5. Criar addons (bordas para pizzas)
      setStatus('Criando addons (bordas)...');
      const pizzaProducts = createdProducts.filter(p => p.name.startsWith('Pizza'));
      const bordas = [
        { name: 'Borda Recheada (Mozzarella ou Catupiry)', price: 3.50 },
        { name: 'Borda Vulcão (Queijo transbordando)', price: 5.00 },
        { name: 'Borda 4 Queijos', price: 5.00 },
        { name: 'Borda Suprema (Queijo + Proteína)', price: 6.00 },
        { name: 'Borda Apózinho (Mini pães recheados)', price: 5.00 },
      ];

      const addons = pizzaProducts.flatMap(pizza =>
        bordas.map(borda => ({
          product_id: pizza.id,
          name: borda.name,
          price: borda.price,
        }))
      );

      await supabase.from('addons').insert(addons);
      setProgress(80);

      // 6. Configurar AI Settings
      setStatus('Configurando IA...');
      await supabase.from('restaurant_ai_settings').insert({
        restaurant_id: restaurantId,
        tone: 'friendly',
        greeting_message: 'Olá! 👋 Bem-vindo à Pizzaria A Família! Somos especialistas em pizzas brasileiras e portuguesas. O que vai ser hoje?',
        closing_message: 'Obrigado pela preferência! 🍕 Bom apetite e até à próxima!',
        upsell_aggressiveness: 'medium',
        max_additional_questions_before_checkout: 2,
        language: 'pt-PT',
        business_rules: `HORÁRIO: Terça a Domingo 18h-23h (Segunda FECHADO)
PAGAMENTOS: MB Way 915817565, Multibanco, Cartão, Dinheiro
ENTREGAS: €3-15 conforme distância + €0,34 embalagem
TEMPO: Retirada 20-30min | Entrega 30-60min`,
        faq_responses: `P: Pizza mais pedida? R: A Família! 🏆
P: Meio a meio? R: Sim! 6 pedaços = 2 sabores, 8 pedaços = 3 sabores
P: MB Way? R: Sim! 915817565`,
        special_offers_info: '🎉 Pizza Maracanã (16 pedaços): €40-50 | Pizza Golias (38 pedaços): €55',
        custom_instructions: 'Pizza "A Família" é a estrela | Perguntar borda em pizzas grandes | Açaí: complementos INCLUÍDOS',
      });
      setProgress(100);

      setStatus('Importação concluída com sucesso! 🎉');
      setSuccess(true);

      // Redirecionar após 2 segundos
      setTimeout(() => {
        navigate('/menu-management');
      }, 2000);
    } catch (err: any) {
      console.error('Erro na importação:', err);
      setError(err.message || 'Erro desconhecido');
      setLoading(false);
    }
  };

  return (
    <div className="container max-w-2xl mx-auto py-10">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Pizza className="h-8 w-8 text-primary" />
            <div>
              <CardTitle>Importar Pizzaria A Família</CardTitle>
              <CardDescription>
                Cria o restaurante completo com cardápio, categorias e configurações
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {!loading && !success && !error && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Este assistente irá criar:
              </p>
              <ul className="list-disc list-inside text-sm space-y-2 text-muted-foreground">
                <li>Restaurante "A Família"</li>
                <li>8 categorias de produtos</li>
                <li>10+ produtos (pizzas, hambúrgueres, açaí)</li>
                <li>Addons (bordas para pizzas)</li>
                <li>Configurações de IA personalizadas</li>
              </ul>
              <Button onClick={importData} className="w-full" size="lg">
                Iniciar Importação
              </Button>
            </div>
          )}

          {loading && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="text-sm font-medium">{status}</span>
              </div>
              <Progress value={progress} className="w-full" />
              <p className="text-xs text-muted-foreground text-center">
                {progress}% concluído
              </p>
            </div>
          )}

          {success && (
            <Alert className="border-green-500/50 bg-green-500/10">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <AlertDescription className="text-green-700 dark:text-green-400">
                {status}
                <br />
                <span className="text-xs">Redirecionando para gestão de menu...</span>
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>
                Erro: {error}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
