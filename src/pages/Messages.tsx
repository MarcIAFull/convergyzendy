import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ConversationList } from '@/components/messages/ConversationList';
import { ChatArea } from '@/components/messages/ChatArea';
import { CustomerDetails } from '@/components/messages/CustomerDetails';
import { useConversationsStore } from '@/stores/conversationsStore';
import { useRestaurantGuard } from '@/hooks/useRestaurantGuard';
import { useIsMobile } from '@/hooks/use-mobile';
import { MessageSquare, ArrowLeft, User } from 'lucide-react';
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
        {/* Mobile Loading */}
        {isMobile ? (
          <Card className="h-full">
            <div className="p-4 space-y-4">
              <Skeleton className="h-10 w-full" />
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          </Card>
        ) : (
          /* Desktop Loading */
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
        <div className="p-4 border-b border-border bg-background">
          {selectedPhone && selectedConversation ? (
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={handleBack}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex-1 min-w-0">
                <h1 className="text-lg font-semibold truncate">
                  {selectedConversation.customerName || selectedPhone}
                </h1>
                <p className="text-sm text-muted-foreground truncate">{selectedPhone}</p>
              </div>
              <Button 
                variant="outline" 
                size="icon"
                onClick={() => setShowCustomerDetails(true)}
              >
                <User className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div>
              <h1 className="text-2xl font-bold">Mensagens</h1>
              <p className="text-sm text-muted-foreground">Gerencie as conversas com seus clientes</p>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {selectedPhone && selectedConversation ? (
            /* Chat View - Full Screen on Mobile */
            <Card className="h-full rounded-none border-0">
              <ChatArea
                selectedPhone={selectedPhone}
                customerName={selectedConversation.customerName}
                mode={selectedConversation.mode}
                restaurantId={restaurant.id}
                onToggleMode={(mode) => toggleMode(selectedPhone, restaurant.id, mode)}
                cart={customerDetails?.cart}
              />
            </Card>
          ) : (
            /* Conversation List */
            <Card className="h-full rounded-none border-0">
              <ConversationList
                conversations={conversations}
                selectedPhone={selectedPhone}
                onSelectConversation={handleSelectConversation}
              />
            </Card>
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
                <CustomerDetails details={customerDetails} />
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

  // Desktop Layout
  return (
    <div className="h-full p-4 md:p-6">
      <div className="mb-4 md:mb-6">
        <h1 className="text-2xl md:text-3xl font-bold">Mensagens</h1>
        <p className="text-muted-foreground text-sm md:text-base">Gerencie as conversas com seus clientes</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[calc(100vh-180px)]">
        {/* Conversation List */}
        <Card className="lg:col-span-3 h-full overflow-hidden">
          <ConversationList
            conversations={conversations}
            selectedPhone={selectedPhone}
            onSelectConversation={handleSelectConversation}
          />
        </Card>

        {/* Chat Area */}
        <Card className="lg:col-span-6 h-full overflow-hidden hidden lg:block">
          {selectedPhone && selectedConversation ? (
            <ChatArea
              selectedPhone={selectedPhone}
              customerName={selectedConversation.customerName}
              mode={selectedConversation.mode}
              restaurantId={restaurant.id}
              onToggleMode={(mode) => toggleMode(selectedPhone, restaurant.id, mode)}
              cart={customerDetails?.cart}
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
        <Card className="lg:col-span-3 h-full overflow-hidden hidden lg:block">
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