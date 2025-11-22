import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Loader2, Pizza, Beef, FileText, ChevronRight } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface MenuSetupStepProps {
  onComplete: (templateId?: string) => Promise<void>;
  onSkip: () => void;
}

const MenuSetupStep = ({ onComplete, onSkip }: MenuSetupStepProps) => {
  const [loading, setLoading] = useState(false);
  const [selectedOption, setSelectedOption] = useState<'empty' | 'pizzeria' | 'hamburger'>('empty');
  const [error, setError] = useState<string | null>(null);

  const templates = [
    {
      id: 'empty',
      name: 'Começar do Zero',
      description: 'Adicione produtos manualmente depois',
      icon: FileText,
    },
    {
      id: 'pizzeria',
      name: 'Pizzaria',
      description: '5 pizzas + 2 bebidas',
      icon: Pizza,
    },
    {
      id: 'hamburger',
      name: 'Hamburgueria',
      description: '3 hambúrgueres + 2 acompanhamentos',
      icon: Beef,
    },
  ];

  const handleContinue = async () => {
    setError(null);
    setLoading(true);

    try {
      if (selectedOption === 'empty') {
        await onComplete();
      } else {
        await onComplete(selectedOption);
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao configurar cardápio');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">Configurar Cardápio (Opcional)</h3>
        <p className="text-sm text-muted-foreground">
          Escolha um template básico ou comece do zero. Você pode personalizar depois.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <RadioGroup
        value={selectedOption}
        onValueChange={(value) => setSelectedOption(value as any)}
        className="space-y-3"
      >
        {templates.map((template) => {
          const Icon = template.icon;
          return (
            <Card
              key={template.id}
              className={`cursor-pointer transition-all hover:border-primary ${
                selectedOption === template.id ? 'border-primary ring-1 ring-primary' : ''
              }`}
              onClick={() => setSelectedOption(template.id as any)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start gap-4">
                  <RadioGroupItem value={template.id} id={template.id} />
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                        selectedOption === template.id ? 'bg-primary text-primary-foreground' : 'bg-muted'
                      }`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{template.name}</CardTitle>
                        <CardDescription className="text-sm">
                          {template.description}
                        </CardDescription>
                      </div>
                    </div>
                  </div>
                </div>
              </CardHeader>
            </Card>
          );
        })}
      </RadioGroup>

      <div className="flex justify-between gap-2 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onSkip}
          disabled={loading}
        >
          Pular Esta Etapa
        </Button>
        <Button onClick={handleContinue} disabled={loading} className="min-w-32">
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Continuar
          <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default MenuSetupStep;
