import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Loader2, Pizza, Beef, FileText, ChevronRight, IceCream, Fish, Coffee } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';

interface MenuSetupStepProps {
  onComplete: (templateId?: string) => Promise<void>;
  onSkip: () => void;
}

const MenuSetupStep = ({ onComplete, onSkip }: MenuSetupStepProps) => {
  const [loading, setLoading] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string>('empty');
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
      description: '5 pizzas + 2 bebidas (preços em €)',
      icon: Pizza,
    },
    {
      id: 'hamburger',
      name: 'Hamburgueria',
      description: '3 hambúrgueres + 2 acompanhamentos (preços em €)',
      icon: Beef,
    },
    {
      id: 'acai',
      name: 'Açaí & Sumos',
      description: '3 açaís + 2 sumos naturais (preços em €)',
      icon: IceCream,
    },
    {
      id: 'sushi',
      name: 'Sushi',
      description: '3 combinados + 2 hot rolls (preços em €)',
      icon: Fish,
    },
    {
      id: 'cafe',
      name: 'Café & Pastelaria',
      description: '3 cafés + 3 doces (preços em €)',
      icon: Coffee,
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
      setError(err.message || 'Erro ao configurar menu');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">Configurar Menu (Opcional)</h3>
        <p className="text-sm text-muted-foreground">
          Escolha um template básico ou comece do zero. Pode personalizar depois.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <ScrollArea className="h-[350px] sm:h-auto">
        <RadioGroup
          value={selectedOption}
          onValueChange={(value) => setSelectedOption(value)}
          className="space-y-3 pr-4 sm:pr-0"
        >
          {templates.map((template) => {
            const Icon = template.icon;
            return (
              <Card
                key={template.id}
                className={`cursor-pointer transition-all hover:border-primary ${
                  selectedOption === template.id ? 'border-primary ring-1 ring-primary' : ''
                }`}
                onClick={() => setSelectedOption(template.id)}
              >
                <CardHeader className="p-3 sm:pb-3">
                  <div className="flex items-start gap-3 sm:gap-4">
                    <RadioGroupItem value={template.id} id={template.id} className="mt-1" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                        <div className={`flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg flex-shrink-0 ${
                          selectedOption === template.id ? 'bg-primary text-primary-foreground' : 'bg-muted'
                        }`}>
                          <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                        </div>
                        <div className="min-w-0">
                          <CardTitle className="text-sm sm:text-base">{template.name}</CardTitle>
                          <CardDescription className="text-xs sm:text-sm truncate">
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
      </ScrollArea>

      <div className="flex flex-col-reverse sm:flex-row justify-between gap-2 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onSkip}
          disabled={loading}
          className="w-full sm:w-auto"
        >
          Saltar Esta Etapa
        </Button>
        <Button 
          onClick={handleContinue} 
          disabled={loading} 
          className="w-full sm:w-auto min-w-32"
        >
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Continuar
          <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default MenuSetupStep;