import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users, MessageSquare, ShoppingCart, Activity, Search, Shield } from 'lucide-react';
import { format } from 'date-fns';

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
