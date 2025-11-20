import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, RefreshCw, CheckCircle2, XCircle, AlertCircle, Clock } from "lucide-react";

type ConnectionStatus = 'connected' | 'waiting_qr' | 'disconnected' | 'unknown';

interface StatusResponse {
  status: ConnectionStatus;
  qr: {
    qrImageUrl: string | null;
    qrBase64: string | null;
  };
  lastCheckedAt: string;
  error?: string;
}

export default function WhatsAppConnection() {
  const { toast } = useToast();
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [testPhone, setTestPhone] = useState("+351912345678");
  const [testMessage, setTestMessage] = useState("Olá! Esta é uma mensagem de teste. 😊");
  const [sending, setSending] = useState(false);

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
          Gerir a conexão do WhatsApp via Evolution API
        </p>
      </div>

      {/* Status Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Estado da Conexão</CardTitle>
              <CardDescription>Estado atual do WhatsApp Business</CardDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={fetchStatus}>
              <RefreshCw className="w-4 h-4" />
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

          {status?.error && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
              <p className="text-sm text-destructive">{status.error}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* QR Code Card */}
      {status?.status === 'waiting_qr' && (status.qr.qrBase64 || status.qr.qrImageUrl) && (
        <Card>
          <CardHeader>
            <CardTitle>Código QR</CardTitle>
            <CardDescription>
              Digitalize este código QR na app WhatsApp para conectar
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <div className="p-4 bg-white rounded-lg">
              {status.qr.qrBase64 ? (
                <img 
                  src={`data:image/png;base64,${status.qr.qrBase64}`} 
                  alt="QR Code" 
                  className="w-64 h-64"
                />
              ) : status.qr.qrImageUrl ? (
                <img 
                  src={status.qr.qrImageUrl} 
                  alt="QR Code" 
                  className="w-64 h-64"
                />
              ) : null}
            </div>
            <p className="text-sm text-center text-muted-foreground max-w-md">
              Abra o WhatsApp no seu telemóvel, vá a <strong>Definições → Dispositivos ligados</strong> e digitalize este código.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Test Message Card */}
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
            <p className="text-sm text-muted-foreground text-center">
              ⚠️ A conexão WhatsApp deve estar ativa para enviar mensagens
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
