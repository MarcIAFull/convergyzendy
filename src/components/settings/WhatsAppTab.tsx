import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurantStore } from "@/stores/restaurantStore";
import { Loader2, RefreshCw, CheckCircle2, XCircle, AlertCircle, Clock, Smartphone, QrCode, Send } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import QRCodeLib from "qrcode";

type ConnectionStatus = 'connected' | 'waiting_qr' | 'disconnected' | 'unknown';

interface StatusResponse {
  status: ConnectionStatus;
  qr: {
    qrText: string | null;
  } | null;
  lastCheckedAt: string;
  message?: string;
  error?: string;
  raw?: any;
}

export function WhatsAppTab() {
  const { toast } = useToast();
  const { restaurant } = useRestaurantStore();
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [testPhone, setTestPhone] = useState("+351912345678");
  const [testMessage, setTestMessage] = useState("Olá! Esta é uma mensagem de teste. 😊");
  const [sending, setSending] = useState(false);
  const [instanceName, setInstanceName] = useState<string | null>(null);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrImageUrl, setQrImageUrl] = useState<string | null>(null);
  const [qrExpiresIn, setQrExpiresIn] = useState<number>(30);
  const [resetting, setResetting] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const webhookUrl = `https://tgbfqcbqfdzrtbtlycve.supabase.co/functions/v1/whatsapp-webhook`;

  const fetchStatus = async (showToast = false, restaurantIdOverride?: string) => {
    const targetRestaurantId = restaurantIdOverride || restaurant?.id;
    
    if (!targetRestaurantId) {
      console.log('[WhatsAppTab] No restaurant selected, skipping fetch');
      setLoading(false);
      return;
    }
    
    console.log('[WhatsAppTab] fetchStatus: Calling evolution-status with restaurant_id:', targetRestaurantId);
    
    try {
      const { data, error } = await supabase.functions.invoke('evolution-status', {
        body: { restaurant_id: targetRestaurantId }
      });
      
      if (error) throw error;
      
      setStatus(data);
      
      if (data.instanceName) {
        setInstanceName(data.instanceName);
      }

      if (showToast && data?.status === 'connected') {
        toast({
          title: "✅ WhatsApp Conectado!",
          description: "A conexão foi estabelecida com sucesso.",
        });
      }
    } catch (error) {
      console.error('Failed to fetch Evolution status:', error);
      if (showToast) {
        toast({
          title: "Erro",
          description: "Não foi possível verificar o estado da conexão.",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshStatus = () => {
    setLoading(true);
    fetchStatus(true);
  };

  const handleReset = async () => {
    if (!restaurant?.id) return;
    
    if (!confirm('Deseja realmente resetar a instância? Isso irá desconectar o WhatsApp atual e gerar um novo QR code.')) {
      return;
    }

    setResetting(true);
    try {
      const { data, error } = await supabase.functions.invoke('evolution-reset', {
        body: { restaurant_id: restaurant.id }
      });
      
      if (error) {
        toast({
          title: "Erro ao Resetar",
          description: error.message || "Não foi possível resetar a instância.",
          variant: "destructive",
        });
        return;
      }

      await fetchStatus();
      
      toast({
        title: "✅ Instância Resetada!",
        description: "A instância foi resetada com sucesso. Escaneie o novo QR code.",
      });
      
      setTimeout(() => setQrModalOpen(true), 500);
    } catch (error) {
      console.error('Failed to reset instance:', error);
      toast({
        title: "Erro Inesperado",
        description: "Erro ao resetar a instância. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setResetting(false);
    }
  };

  const handleConnect = async () => {
    if (!restaurant?.id) return;
    
    setConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke('evolution-connect', {
        body: { restaurant_id: restaurant.id }
      });
      
      if (error) {
        const errorData = error.context?.body;
        
        if (errorData?.errorCode === 'INVALID_CREDENTIALS') {
          toast({
            title: "Credenciais Inválidas",
            description: "A chave da Evolution API está inválida. Contacte o suporte.",
            variant: "destructive",
          });
        } else if (errorData?.errorCode === 'API_UNREACHABLE') {
          toast({
            title: "API Indisponível",
            description: "Não foi possível alcançar o servidor Evolution API. Tente novamente mais tarde.",
            variant: "destructive",
          });
        } else if (errorData?.errorCode === 'NO_RESTAURANT') {
          toast({
            title: "Sem Restaurante",
            description: "Por favor, complete a configuração do restaurante primeiro.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Falha na Conexão",
            description: errorData?.error || error.message,
            variant: "destructive",
          });
        }
        return;
      }

      await fetchStatus();
      
      if (data?.alreadyExists) {
        toast({
          title: "✅ Instância Reconectada!",
          description: "Clique em 'Ver Código QR' para conectar o WhatsApp.",
        });
      } else {
        toast({
          title: "✅ Instância Criada!",
          description: "Clique em 'Ver Código QR' para conectar o WhatsApp.",
        });
      }
      
      setTimeout(() => setQrModalOpen(true), 500);
    } catch (error) {
      console.error('Failed to connect instance:', error);
      toast({
        title: "Erro Inesperado",
        description: "Por favor, tente novamente em alguns instantes.",
        variant: "destructive",
      });
    } finally {
      setConnecting(false);
    }
  };

  useEffect(() => {
    if (status?.status === 'waiting_qr' && status?.qr?.qrText) {
      setQrExpiresIn(30);
      
      const timer = setInterval(() => {
        setQrExpiresIn((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
      return () => clearInterval(timer);
    }
  }, [status?.qr?.qrText]);

  useEffect(() => {
    if (qrExpiresIn === 5 && status?.status === 'waiting_qr') {
      console.log('[WhatsAppTab] QR code expiring soon, auto-refreshing...');
      fetchStatus();
    }
  }, [qrExpiresIn, status?.status]);

  useEffect(() => {
    const generateQRCode = async () => {
      if (status?.qr?.qrText && canvasRef.current) {
        try {
          await QRCodeLib.toCanvas(canvasRef.current, status.qr.qrText, {
            width: 256,
            margin: 2,
            color: {
              dark: '#000000',
              light: '#FFFFFF'
            }
          });
          
          const dataUrl = await QRCodeLib.toDataURL(status.qr.qrText, {
            width: 256,
            margin: 2
          });
          setQrImageUrl(dataUrl);
        } catch (err) {
          console.error('Error generating QR code:', err);
          toast({
            title: "Erro ao gerar QR code",
            description: "Não foi possível gerar a imagem do QR code",
            variant: "destructive"
          });
        }
      }
    };
    
    generateQRCode();
  }, [status?.qr?.qrText]);

  // Reset state and refetch when restaurant changes
  useEffect(() => {
    // Reset local state IMEDIATAMENTE quando restaurante muda
    setStatus(null);
    setInstanceName(null);
    setQrImageUrl(null);
    setQrModalOpen(false);
    setQrExpiresIn(30);
    setTestPhone("+351912345678");
    setTestMessage("Olá! Esta é uma mensagem de teste. 😊");
    
    if (!restaurant?.id) {
      console.log('[WhatsAppTab] No restaurant selected, waiting...');
      setLoading(false);
      return;
    }
    
    setLoading(true);
    console.log('[WhatsAppTab] Restaurant changed to:', restaurant.id, restaurant.name);
    
    // Capturar o ID atual para evitar race conditions
    const currentRestaurantId = restaurant.id;
    
    // Fetch imediato com novo restaurant
    fetchStatus(false, currentRestaurantId);
    
    // Polling periódico - verificar se o restaurante ainda é o mesmo
    const interval = setInterval(() => {
      const storeRestaurant = useRestaurantStore.getState().restaurant;
      if (storeRestaurant?.id === currentRestaurantId) {
        fetchStatus(false, currentRestaurantId);
      } else {
        console.log('[WhatsAppTab] Restaurant changed during poll, clearing interval');
        clearInterval(interval);
      }
    }, 10000);
    
    return () => clearInterval(interval);
  }, [restaurant?.id]);

  const handleSendTest = async () => {
    if (!restaurant?.id) return;
    
    if (!testPhone || !testMessage) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha o número de telefone e a mensagem.",
        variant: "destructive",
      });
      return;
    }

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('evolution-test-message', {
        body: { phone: testPhone, message: testMessage, restaurant_id: restaurant.id },
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: "✅ Mensagem enviada",
          description: "A mensagem de teste foi enviada com sucesso!",
        });
      } else {
        throw new Error(data.error || 'Failed to send message');
      }
    } catch (error) {
      console.error('Failed to send test message:', error);
      toast({
        title: "Erro ao enviar",
        description: error instanceof Error ? error.message : "Não foi possível enviar a mensagem.",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const getStatusBadge = (status: ConnectionStatus) => {
    switch (status) {
      case 'connected':
        return <Badge className="bg-green-500 text-white"><CheckCircle2 className="w-3 h-3 mr-1" />Conectado</Badge>;
      case 'waiting_qr':
        return <Badge className="bg-yellow-500 text-white"><AlertCircle className="w-3 h-3 mr-1" />Aguardando QR</Badge>;
      case 'disconnected':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Desconectado</Badge>;
      default:
        return <Badge variant="secondary"><AlertCircle className="w-3 h-3 mr-1" />Desconhecido</Badge>;
    }
  };

  if (loading && !status) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Estado da Conexão</CardTitle>
              <CardDescription>Estado atual do WhatsApp Business</CardDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={() => fetchStatus()} disabled={loading}>
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              {status && getStatusBadge(status.status)}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefreshStatus}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Verificar Status
                  </>
                )}
              </Button>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span>
                  {status?.lastCheckedAt 
                    ? new Date(status.lastCheckedAt).toLocaleTimeString('pt-PT')
                    : '--:--:--'}
                </span>
              </div>
            </div>
          </div>

          {status?.status === 'disconnected' && !status?.error && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Instância ativa, mas WhatsApp não conectado.</strong><br />
                Clique em "Criar / Conectar Instância" abaixo para gerar o código QR e conectar o seu WhatsApp Business.
              </AlertDescription>
            </Alert>
          )}

          {status?.error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {status.error}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Connection Setup */}
      <Card>
        <CardHeader>
          <CardTitle>Configuração da Instância</CardTitle>
          <CardDescription>
            Gerir a instância Evolution e código QR
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="instance-name">Nome da Instância (Evolution)</Label>
              <Input
                id="instance-name"
                type="text"
                value={instanceName || "Nenhuma instância configurada"}
                disabled
                className="bg-muted"
              />
            <p className="text-xs text-muted-foreground">
              Nome da instância configurada nas variáveis de ambiente
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="webhook-url">Webhook URL</Label>
            <div className="flex gap-2">
              <Input
                id="webhook-url"
                type="text"
                value={webhookUrl}
                readOnly
                className="bg-muted"
              />
              <Button
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(webhookUrl);
                  toast({
                    title: "✅ Copiado",
                    description: "URL do webhook copiado para a área de transferência",
                  });
                }}
              >
                Copiar
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Configure este URL no Evolution API para receber mensagens
            </p>
          </div>

          <div className="flex gap-2">
            <Button 
              onClick={handleConnect} 
              disabled={connecting || resetting}
              className="flex-1"
              size="lg"
            >
              {connecting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  A conectar...
                </>
              ) : (
                <>
                  <Smartphone className="w-4 h-4 mr-2" />
                  Criar / Conectar Instância
                </>
              )}
            </Button>
            
            {status?.status === 'waiting_qr' && status?.qr?.qrText && (
              <Button 
                onClick={() => setQrModalOpen(true)} 
                variant="outline"
                size="lg"
                className="flex-1"
              >
                <QrCode className="w-4 h-4 mr-2" />
                Ver Código QR
              </Button>
            )}
          </div>

          {status?.status !== 'unknown' && (
            <Button 
              onClick={handleReset} 
              disabled={resetting || connecting}
              variant="destructive"
              size="sm"
              className="w-full"
            >
              {resetting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  A resetar...
                </>
              ) : (
                'Resetar Instância (Desconecta e Recria)'
              )}
            </Button>
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* Test Message */}
      <Card>
        <CardHeader>
          <CardTitle>Testar Conexão</CardTitle>
          <CardDescription>
            Envie uma mensagem de teste para verificar a conexão
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="test-phone">Número de Telefone</Label>
            <Input
              id="test-phone"
              type="tel"
              placeholder="+351912345678"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Formato: +351912345678 (com código do país)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="test-message">Mensagem</Label>
            <Textarea
              id="test-message"
              placeholder="Escreva a sua mensagem de teste..."
              value={testMessage}
              onChange={(e) => setTestMessage(e.target.value)}
              rows={4}
            />
          </div>

          <Button 
            onClick={handleSendTest} 
            disabled={sending || status?.status !== 'connected'}
            className="w-full"
          >
            {sending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                A enviar...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Enviar Mensagem de Teste
              </>
            )}
          </Button>

          {status?.status !== 'connected' && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                A conexão WhatsApp deve estar ativa para enviar mensagens
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* QR Code Modal */}
      <Dialog open={qrModalOpen} onOpenChange={setQrModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Conectar WhatsApp Business</DialogTitle>
            <DialogDescription>
              Digitaliza este código QR para conectar a tua conta WhatsApp Business
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {status?.status === 'waiting_qr' && qrExpiresIn > 0 && (
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span>
                  {qrExpiresIn > 0 
                    ? `QR code expira em ${qrExpiresIn}s` 
                    : 'QR code expirado - clique em Atualizar'}
                </span>
              </div>
            )}

            <div className="flex justify-center p-4">
              {status?.qr?.qrText ? (
                <div className="p-4 bg-white rounded-lg border-2 border-border">
                  <canvas ref={canvasRef} />
                </div>
              ) : (
                <div className="w-64 h-64 border-2 border-border rounded-lg flex items-center justify-center bg-muted">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>
            
            {qrExpiresIn === 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>QR Code Expirado!</strong> Clique em "Atualizar QR Code" para gerar um novo código.
                </AlertDescription>
              </Alert>
            )}
            
            <Alert>
              <Smartphone className="h-4 w-4" />
              <AlertDescription>
                <strong>Passos:</strong> Abre o WhatsApp Business no teu telemóvel, vai a <strong>Definições → Dispositivos ligados</strong> e lê este código QR.
              </AlertDescription>
            </Alert>

            <div className="flex gap-2">
              <Button 
                onClick={handleConnect} 
                disabled={connecting}
                variant="outline" 
                className="flex-1"
              >
                {connecting ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />A atualizar...</>
                ) : (
                  <><RefreshCw className="w-4 h-4 mr-2" />Atualizar QR Code</>
                )}
              </Button>

              <Button 
                onClick={handleReset} 
                disabled={resetting}
                variant="destructive" 
                className="flex-1"
              >
                {resetting ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />A resetar...</>
                ) : (
                  'Resetar Instância'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
