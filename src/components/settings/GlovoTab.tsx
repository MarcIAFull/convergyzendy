import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle, XCircle, ExternalLink, Truck, Eye, EyeOff } from 'lucide-react';
import { useRestaurantStore } from '@/stores/restaurantStore';
import { useGlovoStore } from '@/stores/glovoStore';
import { toast } from '@/hooks/use-toast';

type GlovoFormData = {
  enabled: boolean;
  client_id: string;
  client_secret: string;
  environment: 'staging' | 'production';
  pickup_address: string;
  pickup_phone: string;
  pickup_latitude: string;
  pickup_longitude: string;
  webhook_secret: string;
};

const DEFAULT_GLOVO_FORM_DATA: GlovoFormData = {
  enabled: false,
  client_id: '',
  client_secret: '',
  environment: 'staging',
  pickup_address: '',
  pickup_phone: '',
  pickup_latitude: '',
  pickup_longitude: '',
  webhook_secret: '',
};

export function GlovoTab() {
  const { restaurant } = useRestaurantStore();
  const { 
    config, 
    isLoading, 
    error, 
    fetchConfig, 
    saveConfig, 
    testConnection,
    clearError 
  } = useGlovoStore();

  const [formData, setFormData] = useState<GlovoFormData>({ ...DEFAULT_GLOVO_FORM_DATA });

  const [showSecret, setShowSecret] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'connected' | 'disconnected'>('unknown');

  useEffect(() => {
    if (restaurant?.id) {
      // Reset local UI state immediately to avoid showing data from the previous restaurant
      setFormData({ ...DEFAULT_GLOVO_FORM_DATA });
      setShowSecret(false);
      setIsTesting(false);
      setConnectionStatus('unknown');
      clearError();

      fetchConfig(restaurant.id);
    }
  }, [restaurant?.id]);

  useEffect(() => {
    if (config) {
      setFormData({
        enabled: config.enabled || false,
        client_id: config.client_id || '',
        client_secret: config.client_secret || '',
        environment: config.environment || 'staging',
        pickup_address: config.pickup_address || '',
        pickup_phone: config.pickup_phone || '',
        pickup_latitude: config.pickup_latitude?.toString() || '',
        pickup_longitude: config.pickup_longitude?.toString() || '',
        webhook_secret: config.webhook_secret || '',
      });
    }
  }, [config]);

  const handleSave = async () => {
    if (!restaurant?.id) return;

    await saveConfig(restaurant.id, {
      enabled: formData.enabled,
      client_id: formData.client_id || null,
      client_secret: formData.client_secret || null,
      environment: formData.environment,
      pickup_address: formData.pickup_address || null,
      pickup_phone: formData.pickup_phone || null,
      pickup_latitude: formData.pickup_latitude ? parseFloat(formData.pickup_latitude) : null,
      pickup_longitude: formData.pickup_longitude ? parseFloat(formData.pickup_longitude) : null,
      webhook_secret: formData.webhook_secret || null,
    } as any);

    toast({
      title: '✅ Configurações guardadas',
      description: 'As configurações Glovo foram atualizadas.',
    });
  };

  const handleTestConnection = async () => {
    if (!restaurant?.id) return;
    
    setIsTesting(true);
    const success = await testConnection(restaurant.id);
    setConnectionStatus(success ? 'connected' : 'disconnected');
    setIsTesting(false);

    toast({
      title: success ? '✅ Conexão bem-sucedida' : '❌ Falha na conexão',
      description: success 
        ? 'A integração Glovo está funcionando corretamente.' 
        : 'Verifique as credenciais e tente novamente.',
      variant: success ? 'default' : 'destructive',
    });
  };

  const useRestaurantAddress = () => {
    if (restaurant) {
      setFormData(prev => ({
        ...prev,
        pickup_address: restaurant.address || '',
        pickup_phone: restaurant.phone || '',
        pickup_latitude: restaurant.latitude?.toString() || '',
        pickup_longitude: restaurant.longitude?.toString() || '',
      }));
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-warning/10 rounded-lg">
                <Truck className="h-6 w-6 text-warning" />
              </div>
              <div>
                <CardTitle>Glovo On-Demand</CardTitle>
                <CardDescription>
                  Solicite estafetas da Glovo para entregar os seus pedidos
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {connectionStatus === 'connected' && (
                <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Conectado
                </Badge>
              )}
              {connectionStatus === 'disconnected' && (
                <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
                  <XCircle className="h-3 w-3 mr-1" />
                  Desconectado
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Enable/Disable */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <Label className="text-base font-medium">Ativar Glovo On-Demand</Label>
              <p className="text-sm text-muted-foreground">
                Permite solicitar estafetas diretamente dos detalhes do pedido
              </p>
            </div>
            <Switch
              checked={formData.enabled}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, enabled: checked }))}
            />
          </div>

          {/* API Credentials */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Credenciais API</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Client ID</Label>
                <Input
                  value={formData.client_id}
                  onChange={(e) => setFormData(prev => ({ ...prev, client_id: e.target.value }))}
                  placeholder="Seu Client ID da Glovo"
                />
              </div>
              
              <div className="space-y-2">
                <Label>Client Secret</Label>
                <div className="relative">
                  <Input
                    type={showSecret ? 'text' : 'password'}
                    value={formData.client_secret}
                    onChange={(e) => setFormData(prev => ({ ...prev, client_secret: e.target.value }))}
                    placeholder="Seu Client Secret"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-2 top-1/2 -translate-y-1/2"
                    onClick={() => setShowSecret(!showSecret)}
                  >
                    {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Ambiente</Label>
              <Select
                value={formData.environment}
                onValueChange={(value: 'staging' | 'production') => 
                  setFormData(prev => ({ ...prev, environment: value }))
                }
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="staging">Staging (Testes)</SelectItem>
                  <SelectItem value="production">Produção</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Use Staging para testar a integração antes de ir para Produção
              </p>
            </div>
          </div>

          {/* Pickup Address */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">Endereço de Recolha</h3>
              <Button variant="outline" size="sm" onClick={useRestaurantAddress}>
                Usar endereço do restaurante
              </Button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 md:col-span-2">
                <Label>Endereço</Label>
                <Input
                  value={formData.pickup_address}
                  onChange={(e) => setFormData(prev => ({ ...prev, pickup_address: e.target.value }))}
                  placeholder="Rua, Número, Cidade"
                />
              </div>
              
              <div className="space-y-2">
                <Label>Telefone de Contacto</Label>
                <Input
                  value={formData.pickup_phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, pickup_phone: e.target.value }))}
                  placeholder="+351 912 345 678"
                />
              </div>

              <div className="space-y-2">
                <Label>Webhook Secret (opcional)</Label>
                <Input
                  value={formData.webhook_secret}
                  onChange={(e) => setFormData(prev => ({ ...prev, webhook_secret: e.target.value }))}
                  placeholder="Para validar callbacks"
                />
              </div>
              
              <div className="space-y-2">
                <Label>Latitude</Label>
                <Input
                  type="number"
                  step="0.0000001"
                  value={formData.pickup_latitude}
                  onChange={(e) => setFormData(prev => ({ ...prev, pickup_latitude: e.target.value }))}
                  placeholder="37.0893"
                />
              </div>
              
              <div className="space-y-2">
                <Label>Longitude</Label>
                <Input
                  type="number"
                  step="0.0000001"
                  value={formData.pickup_longitude}
                  onChange={(e) => setFormData(prev => ({ ...prev, pickup_longitude: e.target.value }))}
                  placeholder="-8.2473"
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t">
            <Button
              variant="outline"
              onClick={handleTestConnection}
              disabled={isTesting || !formData.client_id || !formData.client_secret}
            >
              {isTesting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  A testar...
                </>
              ) : (
                'Testar Conexão'
              )}
            </Button>

            <Button onClick={handleSave} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  A guardar...
                </>
              ) : (
                'Guardar Configurações'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Como obter credenciais Glovo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
            <li>Contacte a equipa Glovo em <strong>partner.integrationseu@glovoapp.com</strong></li>
            <li>Solicite acesso à API LaaS (Logistics as a Service)</li>
            <li>Receberá as credenciais de Staging para testar</li>
            <li>Após validação, receberá credenciais de Produção</li>
          </ol>
          <Button variant="link" className="p-0 h-auto" asChild>
            <a 
              href="https://api-docs.glovoapp.com/partners/index.html" 
              target="_blank" 
              rel="noopener noreferrer"
            >
              Ver documentação Glovo
              <ExternalLink className="h-3 w-3 ml-1" />
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
