import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageSquare, Smartphone, CheckCircle, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface WhatsAppSetupStepProps {
  onComplete: () => void;
  onSkip: () => void;
}

const WhatsAppSetupStep = ({ onComplete, onSkip }: WhatsAppSetupStepProps) => {
  const navigate = useNavigate();

  const handleConnectNow = () => {
    // Navigate to WhatsApp connection page
    navigate('/whatsapp-connection');
  };

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">Conectar WhatsApp (Opcional)</h3>
        <p className="text-sm text-muted-foreground">
          Conecte seu WhatsApp para começar a receber pedidos dos clientes
        </p>
      </div>

      <div className="grid gap-4">
        {/* WhatsApp Connection Card */}
        <Card className="border-2 border-dashed">
          <CardHeader>
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green/10">
                <MessageSquare className="h-6 w-6 text-green" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-base mb-1">WhatsApp Business</CardTitle>
                <CardDescription>
                  Conecte seu número comercial para receber pedidos via WhatsApp
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 mb-4">
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Receba pedidos automaticamente</p>
                  <p className="text-xs text-muted-foreground">
                    Os clientes podem fazer pedidos direto pelo WhatsApp
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Assistente AI integrado</p>
                  <p className="text-xs text-muted-foreground">
                    Atendimento inteligente 24/7 para seus clientes
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Gestão centralizada</p>
                  <p className="text-xs text-muted-foreground">
                    Acompanhe todas as conversas e pedidos no dashboard
                  </p>
                </div>
              </div>
            </div>
            <Button 
              onClick={handleConnectNow} 
              className="w-full"
              variant="default"
            >
              <Smartphone className="mr-2 h-4 w-4" />
              Conectar Agora
            </Button>
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="bg-muted/50">
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <div className="text-muted-foreground">ℹ️</div>
              <div>
                <p className="text-sm">
                  <strong>Não tem certeza?</strong> Você pode conectar seu WhatsApp depois
                  através do menu de configurações.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-between gap-2 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onSkip}
        >
          Pular Esta Etapa
        </Button>
        <Button onClick={onComplete} variant="secondary" className="min-w-32">
          Concluir Configuração
          <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default WhatsAppSetupStep;
