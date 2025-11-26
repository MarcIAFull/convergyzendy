import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users, MessageSquare, ShoppingCart, Activity, Search, Shield, ArrowRight, Pizza, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { useRestaurantStore } from '@/stores/restaurantStore';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';

interface Restaurant {
  id: string;
  name: string;
  phone: string;
  created_at: string;
  is_open: boolean;
}

interface WhatsAppInstance {
  restaurant_id: string;
  status: string;
  phone_number: string | null;
  last_connected_at: string | null;
}

interface SystemMetrics {
  totalRestaurants: number;
  totalMessages: number;
  totalOrders: number;
  activeConnections: number;
}

export default function Admin() {
  const navigate = useNavigate();
  const { setRestaurant } = useRestaurantStore();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [instances, setInstances] = useState<Record<string, WhatsAppInstance>>({});
  const [metrics, setMetrics] = useState<SystemMetrics>({
    totalRestaurants: 0,
    totalMessages: 0,
    totalOrders: 0,
    activeConnections: 0
  });
  const [searchQuery, setSearchQuery] = useState('');
  
  // Import state
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importStatus, setImportStatus] = useState<string>('');
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState(false);

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate('/login');
        return;
      }

      // Check if user has admin role
      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .single();

      if (!roles) {
        console.error('[Admin] Access denied - not an admin');
        navigate('/dashboard');
        return;
      }

      setIsAdmin(true);
      await loadAdminData();
    } catch (error) {
      console.error('[Admin] Error checking access:', error);
      navigate('/dashboard');
    }
  };

  const loadAdminData = async () => {
    setLoading(true);
    try {
      // Load all restaurants
      const { data: restaurantsData } = await supabase
        .from('restaurants')
        .select('id, name, phone, created_at, is_open')
        .order('created_at', { ascending: false });

      if (restaurantsData) {
        setRestaurants(restaurantsData);
      }

      // Load WhatsApp instances
      const { data: instancesData } = await supabase
        .from('whatsapp_instances')
        .select('restaurant_id, status, phone_number, last_connected_at');

      if (instancesData) {
        const instancesMap: Record<string, WhatsAppInstance> = {};
        instancesData.forEach(instance => {
          instancesMap[instance.restaurant_id] = instance;
        });
        setInstances(instancesMap);
      }

      // Calculate metrics
      const { count: messagesCount } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .gte('timestamp', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      const { count: ordersCount } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      const activeConnections = Object.values(instancesData || []).filter(
        i => i.status === 'connected'
      ).length;

      setMetrics({
        totalRestaurants: restaurantsData?.length || 0,
        totalMessages: messagesCount || 0,
        totalOrders: ordersCount || 0,
        activeConnections
      });
    } catch (error) {
      console.error('[Admin] Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap = {
      connected: { variant: 'default' as const, label: 'Connected' },
      waiting_qr: { variant: 'secondary' as const, label: 'Waiting QR' },
      disconnected: { variant: 'destructive' as const, label: 'Disconnected' }
    };
    const config = statusMap[status as keyof typeof statusMap] || statusMap.disconnected;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const handleSwitchToRestaurant = async (restaurantId: string) => {
    try {
      const restaurant = restaurants.find(r => r.id === restaurantId);
      if (restaurant) {
        setRestaurant(restaurant as any);
        toast.success(`Alternado para ${restaurant.name}`);
        navigate('/');
      }
    } catch (error) {
      console.error('[Admin] Error switching restaurant:', error);
      toast.error('Erro ao alternar restaurante');
    }
  };

  const handleImportPizzaria = async () => {
    setImporting(true);
    setImportError(null);
    setImportSuccess(false);
    setImportProgress(0);

    try {
      // 1. Criar restaurante
      setImportStatus('Criando restaurante...');
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { data: newRestaurant, error: restaurantError } = await supabase
        .from('restaurants')
        .insert({
          name: 'A Família',
          phone: '915817565',
          address: 'Algarve, Portugal',
          delivery_fee: 3.00,
          is_open: true,
          user_id: user.id,
          opening_hours: {
            monday: { open: '', close: '', closed: true },
            tuesday: { open: '18:00', close: '23:00' },
            wednesday: { open: '18:00', close: '23:00' },
            thursday: { open: '18:00', close: '23:00' },
            friday: { open: '18:00', close: '23:00' },
            saturday: { open: '18:00', close: '23:00' },
            sunday: { open: '18:00', close: '23:00' },
          },
        })
        .select()
        .single();

      if (restaurantError) throw restaurantError;
      const restaurantId = newRestaurant.id;
      setImportProgress(10);

      // 2. Criar settings do menu público
      setImportStatus('Configurando menu público...');
      await supabase.from('restaurant_settings').insert({
        restaurant_id: restaurantId,
        slug: 'a-familia',
        menu_enabled: true,
        checkout_web_enabled: true,
        checkout_whatsapp_enabled: true,
      });
      setImportProgress(20);

      // 3. Criar categorias
      setImportStatus('Criando categorias...');
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
      setImportProgress(30);

      // 4. Criar produtos por categoria
      setImportStatus('Criando produtos...');
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
      setImportProgress(60);

      // 5. Criar addons (bordas para pizzas)
      setImportStatus('Criando addons (bordas)...');
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
      setImportProgress(80);

      // 6. Configurar AI Settings
      setImportStatus('Configurando IA...');
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
      setImportProgress(100);

      setImportStatus('Importação concluída com sucesso! 🎉');
      setImportSuccess(true);
      toast.success('Pizzaria A Família criada com sucesso!');

      // Recarregar dados do admin
      setTimeout(() => {
        loadAdminData();
        setImporting(false);
      }, 2000);
    } catch (err: any) {
      console.error('Erro na importação:', err);
      setImportError(err.message || 'Erro desconhecido');
      setImporting(false);
      toast.error('Erro ao importar pizzaria');
    }
  };

  const filteredRestaurants = restaurants.filter(r =>
    r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.phone.includes(searchQuery)
  );

  if (!isAdmin) {
    return null;
  }

  if (loading) {
    return (
      <div className="container mx-auto py-8 space-y-6">
        <div className="flex items-center gap-3">
          <Shield className="h-8 w-8 text-primary" />
          <div>
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-4 w-96" />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-3">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Shield className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Admin Panel</h1>
          <p className="text-muted-foreground">Global system management and monitoring</p>
        </div>
      </div>

      {/* Admin Tools */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Pizza className="h-6 w-6 text-primary" />
            <div>
              <CardTitle>Admin Tools</CardTitle>
              <CardDescription>Ferramentas de administração e importação de dados</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!importing && !importSuccess && !importError && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Importar dados de exemplo da Pizzaria A Família:
              </p>
              <ul className="list-disc list-inside text-sm space-y-1 text-muted-foreground">
                <li>Restaurante "A Família"</li>
                <li>8 categorias de produtos</li>
                <li>10+ produtos (pizzas, hambúrgueres, açaí)</li>
                <li>Addons (bordas para pizzas)</li>
                <li>Configurações de IA personalizadas</li>
              </ul>
              <Button onClick={handleImportPizzaria} className="w-full">
                <Pizza className="mr-2 h-4 w-4" />
                Importar Pizzaria A Família
              </Button>
            </div>
          )}

          {importing && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="text-sm font-medium">{importStatus}</span>
              </div>
              <Progress value={importProgress} className="w-full" />
              <p className="text-xs text-muted-foreground text-center">
                {importProgress}% concluído
              </p>
            </div>
          )}

          {importSuccess && (
            <Alert className="border-green-500/50 bg-green-500/10">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <AlertDescription className="text-green-700 dark:text-green-400">
                {importStatus}
              </AlertDescription>
            </Alert>
          )}

          {importError && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>
                Erro: {importError}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Metrics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Restaurants</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalRestaurants}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Messages (24h)</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalMessages}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Orders (24h)</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalOrders}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Connections</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.activeConnections}</div>
          </CardContent>
        </Card>
      </div>

      {/* Restaurants Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Restaurants</CardTitle>
              <CardDescription>All registered restaurants and their WhatsApp status</CardDescription>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search restaurants..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>WhatsApp Status</TableHead>
                <TableHead>Last Connected</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRestaurants.map((restaurant) => {
                const instance = instances[restaurant.id];
                return (
                  <TableRow key={restaurant.id}>
                    <TableCell className="font-medium">{restaurant.name}</TableCell>
                    <TableCell>{restaurant.phone}</TableCell>
                    <TableCell>
                      {instance ? getStatusBadge(instance.status) : (
                        <Badge variant="outline">Not Configured</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {instance?.last_connected_at
                        ? format(new Date(instance.last_connected_at), 'dd/MM/yyyy HH:mm')
                        : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={restaurant.is_open ? 'default' : 'secondary'}>
                        {restaurant.is_open ? 'Open' : 'Closed'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {format(new Date(restaurant.created_at), 'dd/MM/yyyy')}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleSwitchToRestaurant(restaurant.id)}
                      >
                        Gerenciar
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
