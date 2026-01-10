import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ConversationList } from '@/components/messages/ConversationList';
import { ChatArea } from '@/components/messages/ChatArea';
import { CustomerDetails } from '@/components/messages/CustomerDetails';
import { useConversationsStore } from '@/stores/conversationsStore';
import { useRestaurantGuard } from '@/hooks/useRestaurantGuard';
import { useIsMobile } from '@/hooks/use-mobile';
import { MessageSquare, ArrowLeft, Info } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

export default function Messages() {
  const { restaurant, loading: restaurantLoading } = useRestaurantGuard();
  const isMobile = useIsMobile();
  const [showCustomerDetails, setShowCustomerDetails] = useState(false);
  
  const {
    conversations,
    selectedPhone,
    customerDetails,
    loading,
    loadConversations,
    selectConversation,
    loadCustomerDetails,
    toggleMode,
    subscribeToConversations,
    subscribeToCustomerDetails,
  } = useConversationsStore();

  useEffect(() => {
    if (restaurant?.id) {
      loadConversations(restaurant.id);
      
      // Subscribe to real-time updates
      const unsubscribe = subscribeToConversations(restaurant.id);
      return unsubscribe;
    }
  }, [restaurant?.id, loadConversations, subscribeToConversations]);

  useEffect(() => {
    if (selectedPhone && restaurant?.id) {
      loadCustomerDetails(selectedPhone, restaurant.id);
      
      // Subscribe to customer details updates
      const unsubscribe = subscribeToCustomerDetails(selectedPhone, restaurant.id);
      return unsubscribe;
    }
  }, [selectedPhone, restaurant?.id, loadCustomerDetails, subscribeToCustomerDetails]);

  const handleSelectConversation = (phone: string) => {
    selectConversation(phone);
  };

  const handleBack = () => {
    selectConversation(null);
  };

  if (restaurantLoading || loading) {
    return (
      <div className="h-full p-4 md:p-6">
        {isMobile ? (
          <Card className="h-full">
            <div className="p-4 space-y-3">
              <Skeleton className="h-10 w-full" />
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          </Card>
        ) : (
          <div className="flex gap-4 h-full">
            <Card className="w-80 flex-shrink-0">
              <div className="p-4 space-y-3">
                <Skeleton className="h-10 w-full" />
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            </Card>
            <Card className="flex-1">
              <Skeleton className="h-full" />
            </Card>
          </div>
        )}
      </div>
    );
  }

  if (!restaurant) {
    return null;
  }

  const selectedConversation = conversations.find(c => c.userPhone === selectedPhone);

  // Mobile Layout
  if (isMobile) {
    return (
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 border-b border-border bg-background flex-shrink-0">
          {selectedPhone && selectedConversation ? (
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleBack}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="flex-1 min-w-0">
                <h1 className="text-base font-semibold truncate">
                  {selectedConversation.customerName || selectedPhone}
                </h1>
              </div>
              <Button 
                variant="ghost" 
                size="icon"
                className="h-8 w-8"
                onClick={() => setShowCustomerDetails(true)}
              >
                <Info className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div>
              <h1 className="text-xl font-bold">Mensagens</h1>
              <p className="text-xs text-muted-foreground">Gerencie as conversas</p>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {selectedPhone && selectedConversation ? (
            <ChatArea
              selectedPhone={selectedPhone}
              customerName={selectedConversation.customerName}
              mode={selectedConversation.mode}
              restaurantId={restaurant.id}
              onToggleMode={(mode) => toggleMode(selectedPhone, restaurant.id, mode)}
              cart={customerDetails?.cart}
              onShowDetails={() => setShowCustomerDetails(true)}
            />
          ) : (
            <ConversationList
              conversations={conversations}
              selectedPhone={selectedPhone}
              onSelectConversation={handleSelectConversation}
            />
          )}
        </div>

        {/* Customer Details Sheet for Mobile */}
        <Sheet open={showCustomerDetails} onOpenChange={setShowCustomerDetails}>
          <SheetContent side="right" className="w-full sm:max-w-md p-0">
            <SheetHeader className="p-4 border-b">
              <SheetTitle>Detalhes do Cliente</SheetTitle>
            </SheetHeader>
            <div className="overflow-y-auto h-[calc(100%-60px)]">
              {customerDetails ? (
                <CustomerDetails details={customerDetails} restaurantId={restaurant.id} />
              ) : (
                <div className="p-4 text-center text-muted-foreground">
                  Carregando detalhes...
                </div>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    );
  }

  // Desktop Layout - 2 columns + Sheet for details
  return (
    <div className="h-full p-4 md:p-6 flex flex-col">
      <div className="mb-4 flex-shrink-0">
        <h1 className="text-2xl font-bold">Mensagens</h1>
        <p className="text-muted-foreground text-sm">Gerencie as conversas com seus clientes</p>
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        {/* Conversation List - Fixed width */}
        <Card className="w-80 flex-shrink-0 overflow-hidden">
          <ConversationList
            conversations={conversations}
            selectedPhone={selectedPhone}
            onSelectConversation={handleSelectConversation}
          />
        </Card>

        {/* Chat Area - Flexible */}
        <Card className="flex-1 overflow-hidden">
          {selectedPhone && selectedConversation ? (
            <ChatArea
              selectedPhone={selectedPhone}
              customerName={selectedConversation.customerName}
              mode={selectedConversation.mode}
              restaurantId={restaurant.id}
              onToggleMode={(mode) => toggleMode(selectedPhone, restaurant.id, mode)}
              cart={customerDetails?.cart}
              onShowDetails={() => setShowCustomerDetails(true)}
            />
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-40" />
                <p className="text-base font-medium">Selecione uma conversa</p>
                <p className="text-sm">Escolha uma conversa para começar</p>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Customer Details Sheet for Desktop */}
      <Sheet open={showCustomerDetails} onOpenChange={setShowCustomerDetails}>
        <SheetContent side="right" className="w-[400px] sm:w-[450px] p-0">
          <SheetHeader className="p-4 border-b">
            <SheetTitle>Detalhes do Cliente</SheetTitle>
          </SheetHeader>
          <div className="overflow-y-auto h-[calc(100%-60px)]">
            {customerDetails ? (
              <CustomerDetails details={customerDetails} restaurantId={restaurant.id} />
            ) : (
              <div className="p-4 text-center text-muted-foreground">
                Selecione uma conversa para ver os detalhes
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
