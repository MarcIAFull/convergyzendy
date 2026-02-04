import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/hooks/use-toast';
import { useZoneSoftStore } from '@/stores/zonesoftStore';
import { 
  Printer, 
  CheckCircle, 
  XCircle, 
  Loader2,
  RefreshCw,
  FileText
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ZoneSoftSyncPanelProps {
  orderId: string;
  restaurantId: string;
  zoneSoftDocumentNumber?: number | null;
  zoneSoftDocumentType?: string | null;
  zoneSoftDocumentSeries?: string | null;
  zoneSoftSyncedAt?: string | null;
}

export function ZoneSoftSyncPanel({
  orderId,
  restaurantId,
  zoneSoftDocumentNumber,
  zoneSoftDocumentType,
  zoneSoftDocumentSeries,
  zoneSoftSyncedAt,
}: ZoneSoftSyncPanelProps) {
  const { config, isSyncing, fetchConfig, sendOrderToZoneSoft } = useZoneSoftStore();
  const [localSyncedAt, setLocalSyncedAt] = useState(zoneSoftSyncedAt);
  const [localDocNumber, setLocalDocNumber] = useState(zoneSoftDocumentNumber);
  
  useEffect(() => {
    if (restaurantId) {
      fetchConfig(restaurantId);
    }
  }, [restaurantId, fetchConfig]);
  
  // Update local state when props change
  useEffect(() => {
    setLocalSyncedAt(zoneSoftSyncedAt);
    setLocalDocNumber(zoneSoftDocumentNumber);
  }, [zoneSoftSyncedAt, zoneSoftDocumentNumber]);
  
  // Don't show if ZoneSoft is not enabled
  if (!config?.enabled) {
    return null;
  }
  
  const isSynced = !!localDocNumber;
  
  const handleSendToZoneSoft = async () => {
    const result = await sendOrderToZoneSoft(restaurantId, orderId);
    
    if (result.success) {
      setLocalDocNumber(result.documentNumber || null);
      setLocalSyncedAt(new Date().toISOString());
      toast({
        title: '✅ Enviado para ZoneSoft',
        description: result.documentNumber 
          ? `Documento #${result.documentNumber} criado com sucesso.`
          : 'Pedido enviado para o POS.',
      });
    } else {
      toast({
        variant: 'destructive',
        title: '❌ Erro ao enviar',
        description: result.error || 'Não foi possível enviar o pedido para o ZoneSoft.',
      });
    }
  };
  
  const formatDocumentNumber = () => {
    if (!localDocNumber) return null;
    
    const parts = [];
    if (zoneSoftDocumentType) parts.push(zoneSoftDocumentType);
    if (zoneSoftDocumentSeries) parts.push(zoneSoftDocumentSeries);
    parts.push(`#${localDocNumber}`);
    
    return parts.join(' ');
  };
  
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Printer className="h-4 w-4 text-muted-foreground" />
        <h3 className="font-semibold text-sm">Integração POS</h3>
      </div>
      
      <div className="p-4 rounded-lg bg-muted/50 border border-border space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">ZoneSoft:</span>
            {isSynced ? (
              <Badge variant="default" className="bg-success/10 text-success hover:bg-success/20">
                <CheckCircle className="h-3 w-3 mr-1" />
                Enviado
              </Badge>
            ) : (
              <Badge variant="secondary">
                <XCircle className="h-3 w-3 mr-1" />
                Pendente
              </Badge>
            )}
          </div>
        </div>
        
        {isSynced ? (
          <>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm">
                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">Documento:</span>
                <span className="font-mono font-medium">{formatDocumentNumber()}</span>
              </div>
              {localSyncedAt && (
                <p className="text-xs text-muted-foreground ml-5">
                  Enviado em: {format(new Date(localSyncedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </p>
              )}
            </div>
            
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={handleSendToZoneSoft}
              disabled={isSyncing}
            >
              {isSyncing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Reenviar para POS
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            className="w-full"
            onClick={handleSendToZoneSoft}
            disabled={isSyncing}
          >
            {isSyncing ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Printer className="h-4 w-4 mr-2" />
            )}
            Enviar para ZoneSoft
          </Button>
        )}
      </div>
    </div>
  );
}
