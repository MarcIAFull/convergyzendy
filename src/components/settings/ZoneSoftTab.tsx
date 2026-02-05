import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from '@/hooks/use-toast';
import { useRestaurantStore } from '@/stores/restaurantStore';
import { useZoneSoftStore } from '@/stores/zonesoftStore';
import { ZONESOFT_DOCUMENT_TYPES, ZONESOFT_PAYMENT_TYPES } from '@/types/zonesoft';
import { 
  Printer, 
  CheckCircle, 
  XCircle, 
  Loader2, 
  Eye, 
  EyeOff,
  RefreshCw,
  Link2,
  ChevronDown,
  AlertTriangle,
  ExternalLink,
  Bug
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type ZoneSoftFormData = {
  enabled: boolean;
  client_id: string;
  app_key: string;
  app_secret: string;
  store_id: string;
  warehouse_id: string;
  operator_id: string;
  document_type: string;
  document_series: string;
  payment_type_id: string;
};

const DEFAULT_ZONESOFT_FORM_DATA: ZoneSoftFormData = {
  enabled: false,
  client_id: '',
  app_key: '',
  app_secret: '',
  store_id: '',
  warehouse_id: '1',
  operator_id: '',
  document_type: 'TK',
  document_series: '',
  payment_type_id: '1',
};

export function ZoneSoftTab() {
  const { restaurant } = useRestaurantStore();
  const { 
    config, 
    mappings,
    isLoading, 
    isSyncing,
    fetchConfig, 
    saveConfig, 
    testConnection,
    syncProducts,
    fetchMappings
  } = useZoneSoftStore();
  
  const [showSecret, setShowSecret] = useState(false);
  const [formData, setFormData] = useState<ZoneSoftFormData>({ ...DEFAULT_ZONESOFT_FORM_DATA });
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'success' | 'error'>('unknown');
  const [hasChanges, setHasChanges] = useState(false);
  const [debugInfo, setDebugInfo] = useState<{
    url: string;
    bodyPreview: string;
    signatureVariantsTried: string[];
    storeId: number | null;
    clientIdPreview: string;
  } | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  
  useEffect(() => {
    if (restaurant?.id) {
      // Reset local UI state immediately to avoid showing data from the previous restaurant
      setFormData({ ...DEFAULT_ZONESOFT_FORM_DATA });
      setShowSecret(false);
      setConnectionStatus('unknown');
      setHasChanges(false);
      setDebugInfo(null);
      setShowDebug(false);

      fetchConfig(restaurant.id);
      fetchMappings(restaurant.id);
    }
  }, [restaurant?.id, fetchConfig, fetchMappings]);
  
  useEffect(() => {
    if (config) {
      setFormData({
        enabled: config.enabled || false,
        client_id: config.client_id || '',
        app_key: config.app_key || '',
        app_secret: config.app_secret || '',
        store_id: config.store_id?.toString() || '',
        warehouse_id: config.warehouse_id?.toString() || '1',
        operator_id: config.operator_id?.toString() || '',
        document_type: config.document_type || 'TK',
        document_series: config.document_series || '',
        payment_type_id: config.payment_type_id?.toString() || '1',
      });
      setConnectionStatus(config.last_error ? 'error' : (config.last_sync_at ? 'success' : 'unknown'));
    }
  }, [config]);
  
  const handleChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };
  
  const handleSave = async () => {
    if (!restaurant?.id) return;
    
    const configToSave = {
      enabled: formData.enabled,
      client_id: formData.client_id || null,
      app_key: formData.app_key || null,
      app_secret: formData.app_secret || null,
      store_id: formData.store_id ? parseInt(formData.store_id) : null,
      warehouse_id: formData.warehouse_id ? parseInt(formData.warehouse_id) : 1,
      operator_id: formData.operator_id ? parseInt(formData.operator_id) : null,
      document_type: formData.document_type,
      document_series: formData.document_series || null,
      payment_type_id: formData.payment_type_id ? parseInt(formData.payment_type_id) : 1,
    };
    
    const success = await saveConfig(restaurant.id, configToSave);
    
    if (success) {
      toast({
        title: '✅ Configuração guardada',
        description: 'As credenciais do ZoneSoft foram guardadas com sucesso.',
      });
      setHasChanges(false);
    } else {
      toast({
        variant: 'destructive',
        title: '❌ Erro ao guardar',
        description: 'Não foi possível guardar a configuração.',
      });
    }
  };
  
  const handleTestConnection = async () => {
    if (!restaurant?.id) return;
    
    setDebugInfo(null);
    const result = await testConnection(restaurant.id);
    
    if (result.success) {
      setConnectionStatus('success');
      setDebugInfo(null);
      toast({
        title: '✅ Conexão bem sucedida',
        description: 'A ligação ao ZoneSoft está a funcionar corretamente.',
      });
    } else {
      setConnectionStatus('error');
      // Store debug info if available
      if (result.debug) {
        setDebugInfo(result.debug);
        setShowDebug(true);
      }
      toast({
        variant: 'destructive',
        title: '❌ Falha na conexão',
        description: result.error || 'Verifique as credenciais e tente novamente.',
      });
    }
  };
  
  const handleSyncProducts = async () => {
    if (!restaurant?.id) return;
    
    const result = await syncProducts(restaurant.id);
    
    if (result.success) {
      toast({
        title: '✅ Produtos sincronizados',
        description: `${result.products?.length || 0} produtos obtidos do ZoneSoft.`,
      });
    } else {
      toast({
        variant: 'destructive',
        title: '❌ Erro na sincronização',
        description: result.error || 'Não foi possível obter os produtos.',
      });
    }
  };
  
  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }
  
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Printer className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle>ZoneSoft POS</CardTitle>
                <CardDescription>
                  Integre com o sistema ZoneSoft para impressão automática de tickets
                </CardDescription>
              </div>
            </div>
            <Badge variant={connectionStatus === 'success' ? 'default' : connectionStatus === 'error' ? 'destructive' : 'secondary'}>
              {connectionStatus === 'success' && <><CheckCircle className="h-3 w-3 mr-1" /> Conectado</>}
              {connectionStatus === 'error' && <><XCircle className="h-3 w-3 mr-1" /> Erro</>}
              {connectionStatus === 'unknown' && 'Não configurado'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enable Toggle */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <Label className="text-base font-medium">Ativar Integração ZoneSoft</Label>
              <p className="text-sm text-muted-foreground">
                Enviar pedidos automaticamente para o POS
              </p>
            </div>
            <Switch
              checked={formData.enabled}
              onCheckedChange={(checked) => handleChange('enabled', checked)}
            />
          </div>
          
          <Separator />
          
          {/* API Credentials */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Credenciais API</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="client_id">Client ID</Label>
                <Input
                  id="client_id"
                  placeholder="X-ZS-CLIENT-ID"
                  value={formData.client_id}
                  onChange={(e) => handleChange('client_id', e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="app_key">App Key</Label>
                <Input
                  id="app_key"
                  placeholder="X-ZS-APP-KEY"
                  value={formData.app_key}
                  onChange={(e) => handleChange('app_key', e.target.value)}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="app_secret">App Secret</Label>
              <div className="relative">
                <Input
                  id="app_secret"
                  type={showSecret ? 'text' : 'password'}
                  placeholder="••••••••••••••••"
                  value={formData.app_secret}
                  onChange={(e) => handleChange('app_secret', e.target.value)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                  onClick={() => setShowSecret(!showSecret)}
                >
                  {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Obtenha estas credenciais em developer.zonesoft.org
              </p>
            </div>
          </div>
          
          <Separator />
          
          {/* Store Configuration */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Configuração da Loja</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="store_id">Store ID (loja)</Label>
                <Input
                  id="store_id"
                  type="number"
                  placeholder="1"
                  value={formData.store_id}
                  onChange={(e) => handleChange('store_id', e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="warehouse_id">Warehouse ID (armazem)</Label>
                <Input
                  id="warehouse_id"
                  type="number"
                  placeholder="1"
                  value={formData.warehouse_id}
                  onChange={(e) => handleChange('warehouse_id', e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="operator_id">Operator ID (emp)</Label>
                <Input
                  id="operator_id"
                  type="number"
                  placeholder="100"
                  value={formData.operator_id}
                  onChange={(e) => handleChange('operator_id', e.target.value)}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Tipo de Documento</Label>
                <Select
                  value={formData.document_type}
                  onValueChange={(value) => handleChange('document_type', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ZONESOFT_DOCUMENT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.value} - {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="document_series">Série</Label>
                <Input
                  id="document_series"
                  placeholder="W2024L5"
                  value={formData.document_series}
                  onChange={(e) => handleChange('document_series', e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Tipo de Pagamento</Label>
                <Select
                  value={formData.payment_type_id}
                  onValueChange={(value) => handleChange('payment_type_id', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ZONESOFT_PAYMENT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value.toString()}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          
          <Separator />
          
          {/* Product Sync */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Sincronização de Produtos</h3>
            
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div>
                <p className="text-sm font-medium">
                  {config?.products_synced_at 
                    ? `Última sincronização: ${format(new Date(config.products_synced_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`
                    : 'Produtos ainda não sincronizados'
                  }
                </p>
                <p className="text-xs text-muted-foreground">
                  Produtos mapeados: {mappings.length}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSyncProducts}
                disabled={isSyncing || !formData.client_id}
              >
                {isSyncing ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Sincronizar Produtos
              </Button>
            </div>
          </div>
          
          <Separator />
          
          {/* Debug Info Panel - shows when there's an error */}
          {debugInfo && connectionStatus === 'error' && (
            <Collapsible open={showDebug} onOpenChange={setShowDebug}>
              <Alert variant="destructive" className="border-destructive/50">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Erro de autenticação (401 Unauthorized)</span>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-7 gap-1">
                        <Bug className="h-3.5 w-3.5" />
                        {showDebug ? 'Ocultar detalhes' : 'Ver detalhes'}
                        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showDebug ? 'rotate-180' : ''}`} />
                      </Button>
                    </CollapsibleTrigger>
                  </div>
                  
                  <CollapsibleContent className="space-y-3 pt-2">
                    <div className="rounded-md bg-destructive/10 p-3 text-xs font-mono space-y-2">
                      <div>
                        <span className="text-muted-foreground">URL: </span>
                        <span className="break-all">{debugInfo.url}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Store ID: </span>
                        <span>{debugInfo.storeId ?? 'não definido'}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Client ID: </span>
                        <span>{debugInfo.clientIdPreview}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Body enviado: </span>
                        <span className="break-all">{debugInfo.bodyPreview}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Assinaturas testadas: </span>
                        <span>{debugInfo.signatureVariantsTried.join(', ')}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground">Compare com a documentação:</span>
                      <a 
                        href="https://developer.zonesoft.org" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        Portal ZoneSoft Developer
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </CollapsibleContent>
                </AlertDescription>
              </Alert>
            </Collapsible>
          )}
          
          {/* Actions */}
          <div className="flex items-center justify-between pt-4">
            <Button
              variant="outline"
              onClick={handleTestConnection}
              disabled={isSyncing || !formData.client_id || !formData.app_key || !formData.app_secret}
            >
              {isSyncing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Link2 className="h-4 w-4 mr-2" />
              )}
              Testar Conexão
            </Button>
            
            <Button 
              onClick={handleSave}
              disabled={isLoading || !hasChanges}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Guardar Configurações
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
