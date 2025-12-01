import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users, MessageSquare, ShoppingCart, Activity, Search, Shield, ArrowRight, Pizza, Loader2, CheckCircle, XCircle, Trash2, Upload, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { useRestaurantStore } from '@/stores/restaurantStore';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';

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
  
  // Delete state
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  
  // PDF Upload state
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfRestaurantName, setPdfRestaurantName] = useState('');
  const [pdfRestaurantPhone, setPdfRestaurantPhone] = useState('');
  const [pdfRestaurantAddress, setPdfRestaurantAddress] = useState('');

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
        navigate('/dashboard');
      }
    } catch (error) {
      console.error('[Admin] Error switching restaurant:', error);
      toast.error('Erro ao alternar restaurante');
    }
  };

  const handleDeleteRestaurant = async (restaurantId: string) => {
    setDeleting(true);
    try {
      // Deletar em ordem de dependências (25 tabelas)
      const tables = [
        'cart_item_addons',
        'cart_items',
        'addons',
        'conversation_pending_items',
        'conversation_mode',
        'conversation_state',
        'conversation_recovery_attempts',
        'carts',
        'products',
        'categories',
        'orders',
        'web_orders',
        'messages',
        'ai_interaction_logs',
        'customers',
        'delivery_zones',
        'whatsapp_instances',
        'restaurant_ai_settings',
        'restaurant_prompt_overrides',
        'restaurant_settings',
        'restaurant_owners',
        'subscriptions',
        'invoices',
        'usage_logs',
        'message_debounce_queue'
      ];

      // Deletar tabelas que têm restaurant_id diretamente
      for (const table of tables) {
        const { error } = await supabase
          .from(table as any)
          .delete()
          .eq('restaurant_id', restaurantId);
        
        if (error && !error.message.includes('violates foreign key')) {
          console.warn(`Aviso ao deletar ${table}:`, error);
        }
      }

      // Finalmente deletar o restaurante
      const { error: restaurantError } = await supabase
        .from('restaurants')
        .delete()
        .eq('id', restaurantId);

      if (restaurantError) throw restaurantError;

      toast.success('Restaurante deletado com sucesso!');
      setDeleteConfirm(null);
      await loadAdminData();
    } catch (error: any) {
      console.error('[Admin] Error deleting restaurant:', error);
      toast.error(`Erro ao deletar restaurante: ${error.message}`);
    } finally {
      setDeleting(false);
    }
  };

  const handleImportFromPDF = async () => {
    if (!pdfFile) {
      toast.error('Selecione um arquivo PDF');
      return;
    }

    setImporting(true);
    setImportError(null);
    setImportSuccess(false);
    setImportProgress(0);

    try {
      setImportStatus('Lendo PDF...');
      // TODO: Implementar parsing do PDF usando document--parse_document
      // Por enquanto, mostrar mensagem de funcionalidade em desenvolvimento
      
      toast.info('Funcionalidade de upload de PDF em desenvolvimento. Use a importação da Pizzaria A Família como exemplo.');
      
      setImportProgress(100);
      setImportStatus('Funcionalidade em desenvolvimento');
      
      setTimeout(() => {
        setImporting(false);
        setPdfFile(null);
        setPdfRestaurantName('');
        setPdfRestaurantPhone('');
        setPdfRestaurantAddress('');
      }, 2000);
    } catch (err: any) {
      console.error('Erro no upload do PDF:', err);
      setImportError(err.message || 'Erro desconhecido');
      setImporting(false);
      toast.error('Erro ao processar PDF');
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
      
      // CRÍTICO: Criar entrada no restaurant_owners para evitar violação de RLS
      const { error: ownerError } = await supabase.from('restaurant_owners').insert({
        restaurant_id: restaurantId,
        user_id: user.id,
        role: 'owner',
        permissions: { menu: true, orders: true, settings: true, analytics: true }
      });
      
      if (ownerError) throw ownerError;
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

      // 3. Criar categorias (baseado no PDF completo)
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
        { name: 'Menu Kids', sort_order: 90 },
        { name: 'Porções', sort_order: 100 },
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
        // === ENTRADAS ===
        {
          category_id: categoryMap['Entradas'],
          name: 'Pão de Alho',
          description: 'Pão tradicional com manteiga de alho, assado até ficar dourado e crocante. Serve: 2-3 pessoas',
          price: 7.50,
          is_featured: false,
        },
        
        // === SALGADOS BRASILEIROS ===
        {
          category_id: categoryMap['Salgados Brasileiros'],
          name: 'Salgados - Porção Inteira',
          description: '10 unidades: Kibe, Coxinha ou Bolinha de Queijo (pode escolher misto). Serve: 3-4 pessoas',
          price: 11.00,
          is_featured: false,
        },
        {
          category_id: categoryMap['Salgados Brasileiros'],
          name: 'Salgados - Meia Porção',
          description: '5 unidades: Kibe, Coxinha ou Bolinha de Queijo (pode escolher misto). Serve: 1-2 pessoas',
          price: 6.00,
          is_featured: false,
        },
        
        // === ENROLADOS ===
        {
          category_id: categoryMap['Enrolados'],
          name: 'Enrolado de Queijo e Fiambre',
          description: '12 unidades assadas ou fritas. Recheio: Mozzarella e fiambre. Serve: 2-3 pessoas',
          price: 8.00,
          is_featured: false,
        },
        {
          category_id: categoryMap['Enrolados'],
          name: 'Enrolado de Calabresa com Cebola',
          description: '12 unidades assadas ou fritas. Recheio: Calabresa com cebola caramelizada. Serve: 2-3 pessoas',
          price: 8.00,
          is_featured: false,
        },
        {
          category_id: categoryMap['Enrolados'],
          name: 'Enrolado de Frango com Catupiry',
          description: '12 unidades assadas ou fritas. Recheio: Frango desfiado com catupiry cremoso. Serve: 2-3 pessoas',
          price: 8.00,
          is_featured: false,
        },

        // === PIZZAS SALGADAS - 4 PEDAÇOS ===
        {
          category_id: categoryMap['Pizzas Salgadas'],
          name: 'Pizza A Família - 4 Pedaços',
          description: '⭐ MAIS PEDIDA! Mozzarella, calabresa, frango, barbecue, catupiry, azeitonas. Serve: 1 pessoa',
          price: 11.00,
          is_featured: true,
        },
        {
          category_id: categoryMap['Pizzas Salgadas'],
          name: 'Pizza 4 Queijos - 4 Pedaços',
          description: 'Mozzarella, emmental, cheddar, catupiry. Serve: 1 pessoa',
          price: 11.00,
          is_featured: true,
        },
        {
          category_id: categoryMap['Pizzas Salgadas'],
          name: 'Pizza Margherita - 4 Pedaços',
          description: 'Clássica: mozzarella, molho de tomate, orégãos. Serve: 1 pessoa',
          price: 11.00,
          is_featured: false,
        },
        {
          category_id: categoryMap['Pizzas Salgadas'],
          name: 'Pizza Calabresa - 4 Pedaços',
          description: 'Mozzarella, calabresa brasileira, cebola. Serve: 1 pessoa',
          price: 11.00,
          is_featured: false,
        },
        {
          category_id: categoryMap['Pizzas Salgadas'],
          name: 'Pizza Frango com Catupiry - 4 Pedaços',
          description: 'Frango desfiado, catupiry, milho, mozzarella. Serve: 1 pessoa',
          price: 11.00,
          is_featured: false,
        },

        // === PIZZAS SALGADAS - 6 PEDAÇOS (Até 2 sabores) ===
        {
          category_id: categoryMap['Pizzas Salgadas'],
          name: 'Pizza A Família - 6 Pedaços',
          description: '⭐ MAIS PEDIDA! Até 2 sabores. Mozzarella, calabresa, frango, barbecue, catupiry. Serve: 1-2 pessoas',
          price: 15.90,
          is_featured: true,
        },
        {
          category_id: categoryMap['Pizzas Salgadas'],
          name: 'Pizza 4 Queijos - 6 Pedaços',
          description: 'Até 2 sabores. Mozzarella, emmental, cheddar, catupiry. Serve: 1-2 pessoas',
          price: 15.90,
          is_featured: true,
        },
        {
          category_id: categoryMap['Pizzas Salgadas'],
          name: 'Pizza Portuguesa - 6 Pedaços',
          description: 'Até 2 sabores. Fiambre, ovo, cebola, azeitonas, mozzarella. Serve: 1-2 pessoas',
          price: 15.90,
          is_featured: false,
        },

        // === PIZZAS SALGADAS - 8 PEDAÇOS (Até 3 sabores) ===
        {
          category_id: categoryMap['Pizzas Salgadas'],
          name: 'Pizza A Família - 8 Pedaços',
          description: '⭐ MAIS PEDIDA! Até 3 sabores. Mozzarella, calabresa, frango, barbecue, catupiry. Serve: 2-3 pessoas',
          price: 18.90,
          is_featured: true,
        },
        {
          category_id: categoryMap['Pizzas Salgadas'],
          name: 'Pizza 4 Queijos - 8 Pedaços',
          description: 'Até 3 sabores. Mozzarella, emmental, cheddar, catupiry. Serve: 2-3 pessoas',
          price: 18.90,
          is_featured: true,
        },
        {
          category_id: categoryMap['Pizzas Salgadas'],
          name: 'Pizza Bacon - 8 Pedaços',
          description: 'Até 3 sabores. Bacon crocante, mozzarella, cebola. Serve: 2-3 pessoas',
          price: 18.90,
          is_featured: false,
        },

        // === PIZZAS ESPECIAIS GRANDES ===
        {
          category_id: categoryMap['Pizzas Salgadas'],
          name: 'Pizza Maracanã - 16 Pedaços (Borda Normal)',
          description: '🎉 FESTA! Até 4 sabores (1 pode ser doce). Serve: 4-6 pessoas. Diâmetro: ~45cm',
          price: 40.00,
          is_featured: true,
        },
        {
          category_id: categoryMap['Pizzas Salgadas'],
          name: 'Pizza Maracanã - 16 Pedaços (Borda Recheada)',
          description: '🎉 FESTA! Até 4 sabores (1 pode ser doce). Borda recheada. Serve: 4-6 pessoas',
          price: 45.00,
          is_featured: true,
        },
        {
          category_id: categoryMap['Pizzas Salgadas'],
          name: 'Pizza Golias - 38 Pedaços',
          description: '🎊 GIGANTE! Até 6 sabores (1 pode ser doce). Serve: 10-15 pessoas. Diâmetro: ~60cm',
          price: 55.00,
          is_featured: true,
        },

        // === PIZZAS DOCES ===
        {
          category_id: categoryMap['Pizzas Doces'],
          name: 'Pizza Nutella - 4 Pedaços',
          description: 'Nutella derretida com morangos. Serve: 1 pessoa',
          price: 11.00,
          is_featured: true,
        },
        {
          category_id: categoryMap['Pizzas Doces'],
          name: 'Pizza Romeu e Julieta - 4 Pedaços',
          description: 'Goiabada com queijo. Clássico brasileiro. Serve: 1 pessoa',
          price: 11.00,
          is_featured: false,
        },
        {
          category_id: categoryMap['Pizzas Doces'],
          name: 'Pizza Brigadeiro - 4 Pedaços',
          description: 'Chocolate cremoso com granulado. Serve: 1 pessoa',
          price: 11.00,
          is_featured: false,
        },

        // === HAMBÚRGUERES (todos com batatas fritas INCLUÍDAS) ===
        {
          category_id: categoryMap['Hambúrgueres'],
          name: 'Hambúrguer Brasil',
          description: '🇧🇷 Carne 180g, catupiry, bacon, ovo, batata palha + BATATAS INCLUÍDAS. Serve: 1 pessoa',
          price: 13.90,
          is_featured: true,
        },
        {
          category_id: categoryMap['Hambúrgueres'],
          name: 'Hambúrguer A Família',
          description: '⭐ Carne 180g, queijo, fiambre, ovo, alface, tomate + BATATAS INCLUÍDAS. Serve: 1 pessoa',
          price: 14.90,
          is_featured: true,
        },
        {
          category_id: categoryMap['Hambúrgueres'],
          name: 'Hambúrguer Bacon',
          description: 'Carne 180g, queijo, bacon crocante, cebola caramelizada + BATATAS INCLUÍDAS. Serve: 1 pessoa',
          price: 13.50,
          is_featured: false,
        },
        {
          category_id: categoryMap['Hambúrgueres'],
          name: 'Hambúrguer Frango',
          description: 'Frango grelhado 180g, queijo, alface, tomate, molho especial + BATATAS INCLUÍDAS. Serve: 1 pessoa',
          price: 12.90,
          is_featured: false,
        },

        // === AÇAÍ ===
        {
          category_id: categoryMap['Açaí'],
          name: 'Açaí Pequeno (300ml)',
          description: '🍓 Escolha 5 complementos INCLUÍDOS. Serve: 1 pessoa',
          price: 8.00,
          is_featured: false,
        },
        {
          category_id: categoryMap['Açaí'],
          name: 'Açaí Médio (500ml)',
          description: '🍓 Escolha 7 complementos INCLUÍDOS. Serve: 1-2 pessoas',
          price: 11.00,
          is_featured: true,
        },
        {
          category_id: categoryMap['Açaí'],
          name: 'Açaí Grande (700ml)',
          description: '🍓 Escolha 9 complementos INCLUÍDOS. Serve: 2-3 pessoas',
          price: 14.00,
          is_featured: false,
        },

        // === BEBIDAS ===
        {
          category_id: categoryMap['Bebidas'],
          name: 'Coca-Cola 1L',
          description: 'Refrigerante original',
          price: 3.50,
          is_featured: false,
        },
        {
          category_id: categoryMap['Bebidas'],
          name: 'Água 1.5L',
          description: 'Água mineral natural',
          price: 1.50,
          is_featured: false,
        },
        {
          category_id: categoryMap['Bebidas'],
          name: 'Sumo Natural 500ml',
          description: 'Laranja ou morango natural',
          price: 4.00,
          is_featured: false,
        },
      ];

      const { data: createdProducts } = await supabase
        .from('products')
        .insert(products.map(p => ({ ...p, restaurant_id: restaurantId, is_available: true })))
        .select();

      if (!createdProducts) throw new Error('Falha ao criar produtos');
      setImportProgress(60);

      // 5. Criar addons (bordas para pizzas + complementos açaí)
      setImportStatus('Criando addons...');
      const pizzaProducts = createdProducts.filter(p => p.name.startsWith('Pizza') && !p.name.includes('Doce'));
      const acaiProducts = createdProducts.filter(p => p.name.startsWith('Açaí'));
      
      const bordas = [
        { name: 'Borda Recheada (Mozzarella ou Catupiry)', price: 3.50 },
        { name: 'Borda Vulcão (4 Queijos transbordando)', price: 5.00 },
        { name: 'Borda Suprema (Queijo + Proteína)', price: 6.00 },
        { name: 'Borda Apózinho (Mini pães recheados)', price: 5.00 },
      ];

      const complementosAcai = [
        { name: 'Morango', price: 0 },
        { name: 'Banana', price: 0 },
        { name: 'Kiwi', price: 0 },
        { name: 'Granola', price: 0 },
        { name: 'Leite em Pó', price: 0 },
        { name: 'Nutella', price: 0 },
        { name: 'Paçoca', price: 0 },
        { name: 'Amendoim', price: 0 },
        { name: 'Coco Ralado', price: 0 },
      ];

      const addons = [
        ...pizzaProducts.flatMap(pizza =>
          bordas.map(borda => ({
            product_id: pizza.id,
            name: borda.name,
            price: borda.price,
          }))
        ),
        ...acaiProducts.flatMap(acai =>
          complementosAcai.map(comp => ({
            product_id: acai.id,
            name: comp.name,
            price: comp.price,
          }))
        ),
      ];

      await supabase.from('addons').insert(addons);
      setImportProgress(70);

      // 6. Criar zonas de entrega (baseado no PDF)
      setImportStatus('Configurando zonas de entrega...');
      const deliveryZones = [
        {
          name: 'Zona 1 (Até 2km)',
          coordinates: { type: 'circle', center: { lat: 37.0194, lng: -7.9304 }, radius: 2000 },
          fee_amount: 3.00,
          fee_type: 'fixed',
          min_order_amount: 0,
          is_active: true,
          priority: 1,
        },
        {
          name: 'Zona 2 (2,1-3,5km)',
          coordinates: { type: 'circle', center: { lat: 37.0194, lng: -7.9304 }, radius: 3500 },
          fee_amount: 3.50,
          fee_type: 'fixed',
          min_order_amount: 0,
          is_active: true,
          priority: 2,
        },
        {
          name: 'Zona 3 (3,6-5km)',
          coordinates: { type: 'circle', center: { lat: 37.0194, lng: -7.9304 }, radius: 5000 },
          fee_amount: 5.00,
          fee_type: 'fixed',
          min_order_amount: 15,
          is_active: true,
          priority: 3,
        },
        {
          name: 'Zona 4 (5,1-8km)',
          coordinates: { type: 'circle', center: { lat: 37.0194, lng: -7.9304 }, radius: 8000 },
          fee_amount: 8.00,
          fee_type: 'fixed',
          min_order_amount: 20,
          is_active: true,
          priority: 4,
        },
        {
          name: 'Zona 5 (8,1-15km)',
          coordinates: { type: 'circle', center: { lat: 37.0194, lng: -7.9304 }, radius: 15000 },
          fee_amount: 15.00,
          fee_type: 'fixed',
          min_order_amount: 30,
          is_active: true,
          priority: 5,
        },
      ];

      await supabase.from('delivery_zones').insert(
        deliveryZones.map(z => ({ ...z, restaurant_id: restaurantId }))
      );
      setImportProgress(85);

      // 7. Configurar AI Settings (baseado no FAQ do PDF)
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
ENTREGAS: €3-15 conforme distância + €0,34 taxa embalagem
TEMPO ESTIMADO: Retirada 20-30min | Entrega 30-60min
PEDIDO MÍNIMO: Varia por zona (€15-30 conforme distância)`,
        faq_responses: `P: Pizza mais pedida? R: Pizza A Família! 🏆 É a nossa estrela!
P: Posso pedir meio a meio? R: Sim! 6 pedaços = até 2 sabores | 8 pedaços = até 3 sabores
P: Aceita MB Way? R: Sim! Envie para 915817565
P: Quanto tempo demora? R: Retirada 20-30min | Entrega 30-60min
P: Taxa de entrega? R: €3 a €15 conforme distância + €0,34 embalagem
P: Como funciona o açaí? R: Complementos INCLUÍDOS no preço (5, 7 ou 9 conforme tamanho)
P: Posso mudar a borda? R: Sim! Temos 4 tipos (+€3,50 a €6,00)
P: Hambúrguer vem com batatas? R: Sim! TODAS as batatas fritas estão INCLUÍDAS!`,
        special_offers_info: '🎉 FESTAS: Pizza Maracanã (16 pedaços, 4-6 pessoas): €40-50 | Pizza Golias (38 pedaços, 10-15 pessoas): €55',
        custom_instructions: `IMPORTANTE:
- Pizza "A Família" é a MAIS PEDIDA - destacar sempre
- Perguntar sobre borda em pizzas 8 pedaços ou maiores
- Açaí: complementos JÁ INCLUÍDOS no preço
- Hambúrgueres: batatas fritas JÁ INCLUÍDAS
- Pizzas 6 pedaços = até 2 sabores | 8 pedaços = até 3 sabores
- Sugerir Maracanã/Golias para grupos/festas`,
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
      <div className="grid gap-6 md:grid-cols-2">
        {/* Importar Pizzaria A Família */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Pizza className="h-6 w-6 text-primary" />
              <div>
                <CardTitle>Importar Pizzaria A Família</CardTitle>
                <CardDescription>Importar dados de exemplo completos</CardDescription>
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
                  <li>10 categorias de produtos</li>
                  <li>30+ produtos (pizzas, hambúrgueres, açaí, bebidas)</li>
                  <li>Addons (bordas + complementos açaí)</li>
                  <li>5 zonas de entrega</li>
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

        {/* Upload de PDF Genérico */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <FileText className="h-6 w-6 text-primary" />
              <div>
                <CardTitle>Importar via PDF</CardTitle>
                <CardDescription>Upload de cardápio em PDF para criar restaurante</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="pdf-name">Nome do Restaurante (opcional)</Label>
                  <Input
                    id="pdf-name"
                    placeholder="Ex: Pizzaria Bella Italia"
                    value={pdfRestaurantName}
                    onChange={(e) => setPdfRestaurantName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pdf-phone">Telefone (opcional)</Label>
                  <Input
                    id="pdf-phone"
                    placeholder="Ex: 912345678"
                    value={pdfRestaurantPhone}
                    onChange={(e) => setPdfRestaurantPhone(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pdf-address">Endereço (opcional)</Label>
                  <Input
                    id="pdf-address"
                    placeholder="Ex: Lisboa, Portugal"
                    value={pdfRestaurantAddress}
                    onChange={(e) => setPdfRestaurantAddress(e.target.value)}
                  />
                </div>
              </div>

              <div className="border-2 border-dashed rounded-lg p-6">
                <div className="text-center space-y-2">
                  <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
                  <div>
                    <Label htmlFor="pdf-file" className="cursor-pointer text-sm text-primary hover:underline">
                      {pdfFile ? pdfFile.name : 'Clique para selecionar PDF'}
                    </Label>
                    <Input
                      id="pdf-file"
                      type="file"
                      accept=".pdf"
                      className="hidden"
                      onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                    />
                  </div>
                  {pdfFile && (
                    <p className="text-xs text-muted-foreground">
                      {(pdfFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  )}
                </div>
              </div>

              <Button
                onClick={handleImportFromPDF}
                disabled={!pdfFile || importing}
                className="w-full"
              >
                {importing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <FileText className="mr-2 h-4 w-4" />
                    Importar do PDF
                  </>
                )}
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                O sistema tentará extrair automaticamente categorias, produtos e informações do PDF
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

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
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleSwitchToRestaurant(restaurant.id)}
                        >
                          Gerenciar
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteConfirm(restaurant.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este restaurante? Esta ação irá deletar:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Todos os produtos e categorias</li>
                <li>Todos os pedidos e mensagens</li>
                <li>Todas as configurações e dados</li>
              </ul>
              <p className="mt-2 font-semibold text-destructive">
                Esta ação não pode ser desfeita!
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirm && handleDeleteRestaurant(deleteConfirm)}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deletando...
                </>
              ) : (
                'Confirmar Exclusão'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
