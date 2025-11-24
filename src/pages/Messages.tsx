import { useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { ConversationList } from '@/components/messages/ConversationList';
import { ChatArea } from '@/components/messages/ChatArea';
import { CustomerDetails } from '@/components/messages/CustomerDetails';
import { useConversationsStore } from '@/stores/conversationsStore';
import { useRestaurantGuard } from '@/hooks/useRestaurantGuard';
import { MessageSquare } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export default function Messages() {
  const { restaurant, loading: restaurantLoading } = useRestaurantGuard();
  
  const {
    conversations,
    selectedPhone,
    customerDetails,
    loading,
    loadConversations,
    selectConversation,
    loadCustomerDetails,
    toggleMode,
  } = useConversationsStore();

  useEffect(() => {
    if (restaurant?.id) {
      loadConversations(restaurant.id);
    }
  }, [restaurant?.id, loadConversations]);

  useEffect(() => {
    if (selectedPhone && restaurant?.id) {
      loadCustomerDetails(selectedPhone, restaurant.id);
    }
  }, [selectedPhone, restaurant?.id, loadCustomerDetails]);

  if (restaurantLoading || loading) {
    return (
      <div className="h-full p-6">
        <div className="grid grid-cols-12 gap-4 h-full">
          <Card className="col-span-3">
            <div className="p-4 space-y-4">
              <Skeleton className="h-10 w-full" />
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          </Card>
          <Card className="col-span-6">
            <Skeleton className="h-full" />
          </Card>
          <Card className="col-span-3">
            <Skeleton className="h-full" />
          </Card>
        </div>
      </div>
    );
  }

  if (!restaurant) {
    return null;
  }

  const selectedConversation = conversations.find(c => c.userPhone === selectedPhone);

  return (
    <div className="h-full p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Mensagens</h1>
        <p className="text-muted-foreground">Gerencie as conversas com seus clientes</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[calc(100vh-180px)]">
        {/* Conversation List */}
        <Card className="lg:col-span-3 h-full overflow-hidden">
          <ConversationList
            conversations={conversations}
            selectedPhone={selectedPhone}
            onSelectConversation={selectConversation}
          />
        </Card>

        {/* Chat Area */}
        <Card className="lg:col-span-6 h-full overflow-hidden">
          {selectedPhone && selectedConversation ? (
            <ChatArea
              selectedPhone={selectedPhone}
              customerName={selectedConversation.customerName}
              mode={selectedConversation.mode}
              restaurantId={restaurant.id}
              onToggleMode={(mode) => toggleMode(selectedPhone, restaurant.id, mode)}
            />
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">Selecione uma conversa</p>
                <p className="text-sm">Escolha uma conversa para começar</p>
              </div>
            </div>
          )}
        </Card>

        {/* Customer Details */}
        <Card className="lg:col-span-3 h-full overflow-hidden">
          {customerDetails ? (
            <CustomerDetails details={customerDetails} />
          ) : (
            <div className="h-full flex items-center justify-center p-4">
              <p className="text-sm text-muted-foreground text-center">
                Selecione uma conversa para ver os detalhes do cliente
              </p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
