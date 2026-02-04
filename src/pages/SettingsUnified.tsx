import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Store, Smartphone, Brain, CreditCard, Globe, Wallet, Truck } from 'lucide-react';
import { RestaurantTab } from '@/components/settings/RestaurantTab';
import { WhatsAppTab } from '@/components/settings/WhatsAppTab';
import { AIPersonalizationTab } from '@/components/settings/AIPersonalizationTab';
import { SubscriptionTab } from '@/components/settings/SubscriptionTab';
import { PublicMenuTab } from '@/components/settings/PublicMenuTab';
import { ChatSimulatorTab } from '@/components/settings/ChatSimulatorTab';
import { PaymentsTab } from '@/components/settings/PaymentsTab';
import { GlovoTab } from '@/components/settings/GlovoTab';
import { useRestaurantStore } from '@/stores/restaurantStore';
import { useSearchParams } from 'react-router-dom';

export default function SettingsUnified() {
  const { restaurant } = useRestaurantStore();
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get('tab') || 'restaurant';
  
  // Sub-tabs para seção de IA
  const [aiSubTab, setAiSubTab] = useState<'personalization' | 'simulator'>('personalization');
  
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Configurações</h1>
        <p className="text-muted-foreground mt-2">
          Gerir todas as configurações do seu restaurante
        </p>
      </div>

      {/* KEY força re-mount de todas as tabs quando restaurante muda */}
      <Tabs defaultValue={defaultTab} className="space-y-6" key={restaurant?.id || 'no-restaurant'}>
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="restaurant" className="flex items-center gap-2">
            <Store className="h-4 w-4" />
            <span className="hidden sm:inline">Restaurante</span>
          </TabsTrigger>
          <TabsTrigger value="public-menu" className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            <span className="hidden sm:inline">Menu</span>
          </TabsTrigger>
          <TabsTrigger value="payments" className="flex items-center gap-2">
            <Wallet className="h-4 w-4" />
            <span className="hidden sm:inline">Pagamentos</span>
          </TabsTrigger>
          <TabsTrigger value="glovo" className="flex items-center gap-2">
            <Truck className="h-4 w-4" />
            <span className="hidden sm:inline">Entregas</span>
          </TabsTrigger>
          <TabsTrigger value="whatsapp" className="flex items-center gap-2">
            <Smartphone className="h-4 w-4" />
            <span className="hidden sm:inline">WhatsApp</span>
          </TabsTrigger>
          <TabsTrigger value="ai" className="flex items-center gap-2">
            <Brain className="h-4 w-4" />
            <span className="hidden sm:inline">IA</span>
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

        <TabsContent value="payments">
          <PaymentsTab />
        </TabsContent>

        <TabsContent value="glovo">
          <GlovoTab />
        </TabsContent>

        <TabsContent value="whatsapp">
          <WhatsAppTab />
        </TabsContent>

        <TabsContent value="ai">
          {/* Sub-navegação para IA */}
          <div className="space-y-6">
            <div className="flex gap-2 border-b pb-4">
              <button
                onClick={() => setAiSubTab('personalization')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  aiSubTab === 'personalization'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted hover:bg-muted/80'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Brain className="h-4 w-4" />
                  Personalização
                </div>
              </button>
              <button
                onClick={() => setAiSubTab('simulator')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  aiSubTab === 'simulator'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted hover:bg-muted/80'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Smartphone className="h-4 w-4" />
                  Simulador de Chat
                </div>
              </button>
            </div>
            
            {aiSubTab === 'personalization' && <AIPersonalizationTab />}
            {aiSubTab === 'simulator' && <ChatSimulatorTab />}
          </div>
        </TabsContent>

        <TabsContent value="subscription">
          <SubscriptionTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
