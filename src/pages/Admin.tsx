import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users, MessageSquare, ShoppingCart, Activity, Search, Shield, ArrowRight, Loader2, Trash2, Upload } from 'lucide-react';
import { format } from 'date-fns';
import { useRestaurantStore } from '@/stores/restaurantStore';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

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
  
  // Delete state
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

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
            <Upload className="h-6 w-6 text-primary" />
            <div>
              <CardTitle>Importar Restaurante</CardTitle>
              <CardDescription>Criar novo restaurante a partir de imagem ou PDF do menu</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Use o assistente de importação para criar um novo restaurante com categorias, produtos e configurações automaticamente extraídos do cardápio.
          </p>
          <Button onClick={() => navigate('/admin/import-restaurant')} className="w-full">
            <Upload className="mr-2 h-4 w-4" />
            Ir para Importação
          </Button>
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
