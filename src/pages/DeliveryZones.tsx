import { useState, useEffect } from 'react';
import DashboardLayout from '@/layouts/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Edit, Trash2, MapPin, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useRestaurantGuard } from '@/hooks/useRestaurantGuard';
import { toast } from 'sonner';
import { DeliveryZoneMap } from '@/components/delivery/DeliveryZoneMap';
import { useGoogleMapsApiKey } from '@/hooks/useGoogleMapsApiKey';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';

interface DeliveryZone {
  id: string;
  name: string;
  coordinates: any;
  fee_type: string;
  fee_amount: number;
  min_order_amount: number | null;
  max_delivery_time_minutes: number | null;
  is_active: boolean;
  priority: number;
}

export default function DeliveryZones() {
  const { restaurant: currentRestaurant, loading: restaurantLoading } = useRestaurantGuard();
  const { apiKey, loading: apiKeyLoading, error: apiKeyError } = useGoogleMapsApiKey();
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<DeliveryZone | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    fee_type: 'fixed',
    fee_amount: 3,
    min_order_amount: 0,
    max_delivery_time_minutes: 60,
    is_active: true,
    priority: 0,
    radius: 5
  });

  const [restaurantLocation, setRestaurantLocation] = useState<[number, number] | null>(null);

  useEffect(() => {
    if (currentRestaurant) {
      loadZones();
      loadRestaurantLocation();
    }
  }, [currentRestaurant]);

  const loadRestaurantLocation = async () => {
    if (!currentRestaurant) return;

    const { data } = await supabase
      .from('restaurants')
      .select('latitude, longitude')
      .eq('id', currentRestaurant.id)
      .single();

    if (data?.latitude && data?.longitude) {
      setRestaurantLocation([data.latitude, data.longitude]);
    } else {
      // Default to Lisbon
      setRestaurantLocation([38.7223, -9.1393]);
    }
  };

  const loadZones = async () => {
    if (!currentRestaurant) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('delivery_zones')
        .select('*')
        .eq('restaurant_id', currentRestaurant.id)
        .order('priority', { ascending: false });

      if (error) throw error;
      setZones(data || []);
    } catch (error: any) {
      console.error('Error loading zones:', error);
      toast.error('Erro ao carregar zonas de entrega');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!currentRestaurant || !restaurantLocation) return;

    try {
      const zoneData = {
        restaurant_id: currentRestaurant.id,
        name: formData.name,
        coordinates: {
          type: 'circle',
          center: { lat: restaurantLocation[0], lng: restaurantLocation[1] },
          radius: formData.radius
        },
        fee_type: formData.fee_type,
        fee_amount: formData.fee_amount,
        min_order_amount: formData.min_order_amount || null,
        max_delivery_time_minutes: formData.max_delivery_time_minutes || null,
        is_active: formData.is_active,
        priority: formData.priority
      };

      if (editingZone) {
        const { error } = await supabase
          .from('delivery_zones')
          .update(zoneData)
          .eq('id', editingZone.id);

        if (error) throw error;
        toast.success('Zona atualizada com sucesso');
      } else {
        const { error } = await supabase
          .from('delivery_zones')
          .insert(zoneData);

        if (error) throw error;
        toast.success('Zona criada com sucesso');
      }

      setDialogOpen(false);
      resetForm();
      loadZones();
    } catch (error: any) {
      console.error('Error saving zone:', error);
      toast.error('Erro ao salvar zona');
    }
  };

  const handleDelete = async (zoneId: string) => {
    if (!confirm('Deseja realmente excluir esta zona?')) return;

    try {
      const { error } = await supabase
        .from('delivery_zones')
        .delete()
        .eq('id', zoneId);

      if (error) throw error;
      toast.success('Zona excluída com sucesso');
      loadZones();
    } catch (error: any) {
      console.error('Error deleting zone:', error);
      toast.error('Erro ao excluir zona');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      fee_type: 'fixed',
      fee_amount: 3,
      min_order_amount: 0,
      max_delivery_time_minutes: 60,
      is_active: true,
      priority: 0,
      radius: 5
    });
    setEditingZone(null);
  };

  if (restaurantLoading || loading || apiKeyLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (apiKeyError || !apiKey) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center text-muted-foreground">
          <p>Erro ao carregar Google Maps API Key</p>
          <p className="text-sm">{apiKeyError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Zonas de Entrega</h1>
            <p className="text-muted-foreground">
              Configure áreas de entrega, taxas e tempos estimados
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="h-4 w-4 mr-2" />
                Nova Zona
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md z-50 bg-background">
              <DialogHeader>
                <DialogTitle>
                  {editingZone ? 'Editar Zona' : 'Nova Zona de Entrega'}
                </DialogTitle>
                <DialogDescription>
                  Configure os detalhes da zona de entrega
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Nome da Zona</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Centro, Zona Norte, etc."
                  />
                </div>

                <div>
                  <Label htmlFor="radius">Raio de Entrega (km)</Label>
                  <Input
                    id="radius"
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="50"
                    value={formData.radius}
                    onChange={(e) => setFormData({ ...formData, radius: parseFloat(e.target.value) })}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Área circular a partir do restaurante
                  </p>
                </div>

                <div>
                  <Label htmlFor="fee_type">Tipo de Taxa</Label>
                  <Select
                    value={formData.fee_type}
                    onValueChange={(value) => setFormData({ ...formData, fee_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixed">Fixa</SelectItem>
                      <SelectItem value="per_km">Por Km</SelectItem>
                      <SelectItem value="tiered">Escalonada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="fee_amount">Valor da Taxa (€)</Label>
                  <Input
                    id="fee_amount"
                    type="number"
                    step="0.5"
                    value={formData.fee_amount}
                    onChange={(e) => setFormData({ ...formData, fee_amount: parseFloat(e.target.value) })}
                  />
                </div>

                <div>
                  <Label htmlFor="min_order">Pedido Mínimo (€)</Label>
                  <Input
                    id="min_order"
                    type="number"
                    step="0.5"
                    value={formData.min_order_amount}
                    onChange={(e) => setFormData({ ...formData, min_order_amount: parseFloat(e.target.value) })}
                  />
                </div>

                <div>
                  <Label htmlFor="max_time">Tempo Máximo (minutos)</Label>
                  <Input
                    id="max_time"
                    type="number"
                    value={formData.max_delivery_time_minutes}
                    onChange={(e) => setFormData({ ...formData, max_delivery_time_minutes: parseInt(e.target.value) })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="is_active">Zona Ativa</Label>
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  />
                </div>

                <Button onClick={handleSave} className="w-full">
                  {editingZone ? 'Atualizar' : 'Criar'} Zona
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {restaurantLocation && (
          <Card>
            <CardHeader>
              <CardTitle>Mapa de Cobertura</CardTitle>
              <CardDescription>
                Visualize as zonas de entrega configuradas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DeliveryZoneMap
                center={restaurantLocation}
                zones={zones}
                height="500px"
                apiKey={apiKey}
              />
              <p className="text-xs text-muted-foreground mt-2">
                Centro: {restaurantLocation[0].toFixed(6)}, {restaurantLocation[1].toFixed(6)}
              </p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Zonas Cadastradas</CardTitle>
            <CardDescription>
              {zones.length} {zones.length === 1 ? 'zona configurada' : 'zonas configuradas'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {zones.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MapPin className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma zona de entrega configurada</p>
                <p className="text-sm">Clique em "Nova Zona" para começar</p>
              </div>
            ) : (
              <div className="space-y-3">
                {zones.map((zone) => (
                  <div
                    key={zone.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold">{zone.name}</h3>
                        <Badge variant={zone.is_active ? 'default' : 'secondary'}>
                          {zone.is_active ? 'Ativa' : 'Inativa'}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <p>
                          Taxa: €{zone.fee_amount.toFixed(2)} ({zone.fee_type === 'fixed' ? 'Fixa' : zone.fee_type === 'per_km' ? 'Por Km' : 'Escalonada'})
                        </p>
                        {zone.coordinates?.radius && (
                          <p>Raio: {zone.coordinates.radius} km</p>
                        )}
                        {zone.min_order_amount && (
                          <p>Pedido mínimo: €{zone.min_order_amount.toFixed(2)}</p>
                        )}
                        {zone.max_delivery_time_minutes && (
                          <p>Tempo máximo: {zone.max_delivery_time_minutes} min</p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditingZone(zone);
                          setFormData({
                            name: zone.name,
                            fee_type: zone.fee_type,
                            fee_amount: zone.fee_amount,
                            min_order_amount: zone.min_order_amount || 0,
                            max_delivery_time_minutes: zone.max_delivery_time_minutes || 60,
                            is_active: zone.is_active,
                            priority: zone.priority,
                            radius: zone.coordinates?.radius || 5
                          });
                          setDialogOpen(true);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(zone.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
