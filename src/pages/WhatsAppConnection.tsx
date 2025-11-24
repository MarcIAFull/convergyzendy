import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, RefreshCw, CheckCircle2, XCircle, AlertCircle, Clock, Smartphone } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

type ConnectionStatus = 'connected' | 'waiting_qr' | 'disconnected' | 'unknown';

interface StatusResponse {
  status: ConnectionStatus;
  qr: {
    qrImageUrl: string | null;
    qrBase64: string | null;
  };
  lastCheckedAt: string;
  message?: string;
  error?: string;
  raw?: any;
}

export default function WhatsAppConnection() {
  const { toast } = useToast();
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [testPhone, setTestPhone] = useState("+351912345678");
  const [testMessage, setTestMessage] = useState("Olá! Esta é uma mensagem de teste. 😊");
  const [sending, setSending] = useState(false);
  const instanceName = "convergy"; // This would come from env in production
  const webhookUrl = `https://tgbfqcbqfdzrtbtlycve.supabase.co/functions/v1/whatsapp-webhook`;

  const fetchStatus = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('evolution-status');
      
      if (error) throw error;
      
      setStatus(data);
    } catch (error) {
      console.error('Failed to fetch Evolution status:', error);
      toast({
        title: "Erro",
        description: "Não foi possível verificar o estado da conexão.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke('evolution-connect');
      
      if (error) throw error;

      setStatus(data);

      if (data.error) {
        toast({
          title: "Erro",
          description: data.error,
          variant: "destructive",
        });
      } else {
        toast({
          title: "✅ Sucesso",
          description: data.message || "Instância criada/conectada com sucesso!",
        });
      }
    } catch (error) {
      console.error('Failed to connect instance:', error);
      toast({
        title: "Erro ao conectar",
        description: error instanceof Error ? error.message : "Não foi possível conectar à instância.",
        variant: "destructive",
      });
    } finally {
      setConnecting(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    
    // Poll every 10 seconds
    const interval = setInterval(fetchStatus, 10000);
    
    return () => clearInterval(interval);
  }, []);

  const handleSendTest = async () => {
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
        body: { phone: testPhone, message: testMessage },
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Conexão WhatsApp</h1>
        <p className="text-muted-foreground mt-2">
          Centro de controlo da integração Evolution API
        </p>
      </div>

      {/* (A) Connection Status Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Estado da Conexão</CardTitle>
              <CardDescription>Estado atual do WhatsApp Business</CardDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={fetchStatus} disabled={loading}>
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              {status && getStatusBadge(status.status)}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span>
                {status?.lastCheckedAt 
                  ? new Date(status.lastCheckedAt).toLocaleTimeString('pt-PT')
                  : '--:--:--'}
              </span>
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

      {/* (B) Instance Setup + QR Code Card */}
      <Card>
        <CardHeader>
          <CardTitle>Configuração da Instância</CardTitle>
          <CardDescription>
            Gerir a instância Evolution e código QR
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Instance Name */}
          <div className="space-y-2">
            <Label htmlFor="instance-name">Nome da Instância (Evolution)</Label>
            <Input
              id="instance-name"
              type="text"
              value={instanceName}
              disabled
              className="bg-muted"
            />
            <p className="text-xs text-muted-foreground">
              Nome da instância configurada nas variáveis de ambiente
            </p>
          </div>

          {/* Webhook URL */}
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

          {/* Connect Button */}
          <Button 
            onClick={handleConnect} 
            disabled={connecting}
            className="w-full"
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

          {/* QR Code Section */}
          {status?.status === 'waiting_qr' && (status.qr.qrBase64 || status.qr.qrImageUrl) && (() => {
            const qrSrc = status.qr.qrImageUrl ?? (status.qr.qrBase64 ? `data:image/png;base64,${status.qr.qrBase64}` : null);
            
            if (!qrSrc) return null;
            
            return (
              <div className="pt-6 border-t space-y-4">
                <div>
                  <h3 className="text-lg font-semibold">Ligar WhatsApp Business</h3>
                  <p className="text-sm text-muted-foreground">
                    Digitaliza este código QR para conectar a tua conta
                  </p>
                </div>

                <div className="flex flex-col items-center gap-4">
                  <div className="p-4 bg-white rounded-lg border-2 border-border">
                    <img 
                      src={qrSrc} 
                      alt="QR Code" 
                      className="w-64 h-64"
                    />
                  </div>
                  
                  <Alert>
                    <Smartphone className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Passos:</strong> Abre o WhatsApp Business no teu telemóvel, vai a <strong>Definições → Dispositivos ligados</strong> e lê este código QR.
                    </AlertDescription>
                  </Alert>
                </div>
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* (C) Send Test Message Card */}
      <Card>
        <CardHeader>
          <CardTitle>Enviar Mensagem de Teste</CardTitle>
          <CardDescription>
            Teste a conexão enviando uma mensagem de WhatsApp
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
              'Enviar Mensagem de Teste'
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
    </div>
  );
}
