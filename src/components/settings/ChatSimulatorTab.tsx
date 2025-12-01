import { useRestaurantStore } from '@/stores/restaurantStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AITestChatSimulator } from '@/components/ai-config/AITestChatSimulator';

export function ChatSimulatorTab() {
  const { restaurant } = useRestaurantStore();

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Simulador de Chat</CardTitle>
          <CardDescription>
            Teste o atendimento da IA em tempo real. Simule conversas como se fosse um cliente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {restaurant?.id ? (
            <AITestChatSimulator restaurantId={restaurant.id} />
          ) : (
            <p className="text-muted-foreground text-center py-8">
              Selecione um restaurante para testar o chat
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
