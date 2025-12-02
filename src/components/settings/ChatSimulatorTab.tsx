import { useRestaurantStore } from '@/stores/restaurantStore';
import { Card, CardContent } from '@/components/ui/card';
import { AITestChatSimulator } from '@/components/ai-config/AITestChatSimulator';

export function ChatSimulatorTab() {
  const { restaurant } = useRestaurantStore();

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Simulador de Chat</h2>
        <p className="text-sm text-muted-foreground">
          Teste o atendimento da IA em tempo real. Simule conversas como se fosse um cliente.
        </p>
      </div>
      {restaurant?.id ? (
        <AITestChatSimulator restaurantId={restaurant.id} />
      ) : (
        <Card>
          <CardContent className="py-8">
            <p className="text-muted-foreground text-center">
              Selecione um restaurante para testar o chat
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
