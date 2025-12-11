import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Store, Smartphone, Brain, CreditCard, Globe, MessageSquare, Coins } from 'lucide-react';
import { RestaurantTab } from '@/components/settings/RestaurantTab';
import { WhatsAppTab } from '@/components/settings/WhatsAppTab';
import { AIPersonalizationTab } from '@/components/settings/AIPersonalizationTab';
import { SubscriptionTab } from '@/components/settings/SubscriptionTab';
import { PublicMenuTab } from '@/components/settings/PublicMenuTab';
import { ChatSimulatorTab } from '@/components/settings/ChatSimulatorTab';
import { TokenUsageTab } from '@/components/settings/TokenUsageTab';
import { useRestaurantStore } from '@/stores/restaurantStore';

export default function SettingsUnified() {
  const { restaurant } = useRestaurantStore();
  
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Configurações</h1>
        <p className="text-muted-foreground mt-2">
          Gerir todas as configurações do seu restaurante
        </p>
      </div>

      {/* KEY força re-mount de todas as tabs quando restaurante muda */}
      <Tabs defaultValue="restaurant" className="space-y-6" key={restaurant?.id || 'no-restaurant'}>
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="restaurant" className="flex items-center gap-2">
            <Store className="h-4 w-4" />
            <span className="hidden sm:inline">Restaurante</span>
          </TabsTrigger>
          <TabsTrigger value="public-menu" className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            <span className="hidden sm:inline">Menu</span>
          </TabsTrigger>
          <TabsTrigger value="whatsapp" className="flex items-center gap-2">
            <Smartphone className="h-4 w-4" />
            <span className="hidden sm:inline">WhatsApp</span>
          </TabsTrigger>
          <TabsTrigger value="ai" className="flex items-center gap-2">
            <Brain className="h-4 w-4" />
            <span className="hidden sm:inline">IA</span>
          </TabsTrigger>
          <TabsTrigger value="chat-simulator" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            <span className="hidden sm:inline">Simulador</span>
          </TabsTrigger>
          <TabsTrigger value="tokens" className="flex items-center gap-2">
            <Coins className="h-4 w-4" />
            <span className="hidden sm:inline">Tokens</span>
          </TabsTrigger>
          <TabsTrigger value="subscription" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            <span className="hidden sm:inline">Plano</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="restaurant">
          <RestaurantTab />
        </TabsContent>

        <TabsContent value="public-menu">
          <PublicMenuTab />
        </TabsContent>

        <TabsContent value="whatsapp">
          <WhatsAppTab />
        </TabsContent>

        <TabsContent value="ai">
          <AIPersonalizationTab />
        </TabsContent>

        <TabsContent value="chat-simulator">
          <ChatSimulatorTab />
        </TabsContent>

        <TabsContent value="tokens">
          <TokenUsageTab />
        </TabsContent>

        <TabsContent value="subscription">
          <SubscriptionTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
