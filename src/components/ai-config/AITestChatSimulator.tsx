import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Send, RefreshCw, MessageSquare, ShoppingCart, Activity } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface TestMessage {
  id: string;
  body: string;
  direction: 'inbound' | 'outbound';
  timestamp: Date;
}

interface CartItem {
  product_name: string;
  quantity: number;
  price: number;
}

interface PendingItem {
  product_name: string;
  quantity: number;
}

interface AITestChatSimulatorProps {
  restaurantId: string;
}

export function AITestChatSimulator({ restaurantId }: AITestChatSimulatorProps) {
  const [messages, setMessages] = useState<TestMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [testPhone] = useState("+351999999999");
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);
  const [conversationState, setConversationState] = useState("idle");
  const [lastIntent, setLastIntent] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<any>(null);
  const { toast } = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (restaurantId) {
      loadConversationState();
    }
  }, [restaurantId]);

  const loadConversationState = async () => {
    try {
      const { data: stateData } = await supabase
        .from('conversation_state')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .eq('user_phone', testPhone)
        .maybeSingle();

      if (stateData) {
        setConversationState(stateData.state);
        setMetadata(stateData.metadata);

        if (stateData.cart_id) {
          const { data: cartData } = await supabase
            .from('cart_items')
            .select(`
              quantity,
              products (name, price)
            `)
            .eq('cart_id', stateData.cart_id);

          if (cartData) {
            setCartItems(cartData.map((item: any) => ({
              product_name: item.products?.name || 'Produto',
              quantity: item.quantity,
              price: item.products?.price || 0,
            })));
          }
        } else {
          setCartItems([]);
        }
      }

      // Load pending items
      const { data: pendingData } = await supabase
        .from('conversation_pending_items')
        .select(`
          quantity,
          products (name)
        `)
        .eq('restaurant_id', restaurantId)
        .eq('user_phone', testPhone)
        .eq('status', 'pending');

      if (pendingData) {
        setPendingItems(pendingData.map((item: any) => ({
          product_name: item.products?.name || 'Produto',
          quantity: item.quantity,
        })));
      } else {
        setPendingItems([]);
      }
    } catch (error) {
      console.error('Error loading state:', error);
    }
  };

  const sendTestMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    setIsLoading(true);
    const userMessage: TestMessage = {
      id: Date.now().toString(),
      body: inputMessage,
      direction: 'inbound',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    const messageToSend = inputMessage;
    setInputMessage("");

    try {
      // CRITICAL FIX: Save inbound message to database BEFORE calling AI
      // This ensures conversation_history includes customer messages
      const { data: restaurantData } = await supabase
        .from('restaurants')
        .select('phone')
        .eq('id', restaurantId)
        .single();
      
      const restaurantPhone = restaurantData?.phone || 'restaurant';
      
      const { error: insertError } = await supabase
        .from('messages')
        .insert({
          restaurant_id: restaurantId,
          from_number: testPhone,
          to_number: restaurantPhone,
          body: messageToSend,
          direction: 'inbound'
        });

      if (insertError) {
        console.warn('[AITestChatSimulator] Failed to save inbound message:', insertError);
      }

      const { data, error } = await supabase.functions.invoke('whatsapp-ai-agent', {
        body: {
          restaurantId,
          customerPhone: testPhone,
          messageBody: messageToSend
        }
      });

      if (error) throw error;

      // Fix: Use data.message instead of data.response
      const responseText = data?.message || data?.response;
      
      if (responseText) {
        const aiMessage: TestMessage = {
          id: (Date.now() + 1).toString(),
          body: responseText,
          direction: 'outbound',
          timestamp: new Date()
        };
        setMessages(prev => [...prev, aiMessage]);
      }

      // Update state from response
      if (data?.state) {
        setConversationState(data.state);
      }
      if (data?.intent) {
        setLastIntent(data.intent);
      }

      await loadConversationState();
    } catch (error: any) {
      console.error('Error:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao enviar mensagem",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const clearTest = async () => {
    try {
      await supabase
        .from('carts')
        .update({ status: 'abandoned' })
        .eq('restaurant_id', restaurantId)
        .eq('user_phone', testPhone)
        .eq('status', 'active');

      await supabase
        .from('conversation_state')
        .delete()
        .eq('restaurant_id', restaurantId)
        .eq('user_phone', testPhone);

      await supabase
        .from('conversation_pending_items')
        .delete()
        .eq('restaurant_id', restaurantId)
        .eq('user_phone', testPhone);

      setMessages([]);
      setCartItems([]);
      setPendingItems([]);
      setConversationState("idle");
      setLastIntent(null);
      setMetadata(null);

      toast({
        title: "Teste resetado",
        description: "Conversa e estado limpos"
      });
    } catch (error: any) {
      console.error('Error clearing test:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao resetar teste",
        variant: "destructive"
      });
    }
  };

  const cartTotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Chat Area - Left Side (2 columns) */}
      <Card className="lg:col-span-2 flex flex-col h-[600px]">
        <div className="p-4 border-b flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Chat de Teste</h3>
            <p className="text-xs text-muted-foreground">Telefone: {testPhone}</p>
          </div>
          <Button variant="outline" size="sm" onClick={clearTest}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Resetar
          </Button>
        </div>

        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          <div className="space-y-3">
            {messages.length === 0 && (
              <div className="text-center text-muted-foreground py-8">
                <MessageSquare className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Envie uma mensagem para testar</p>
                <p className="text-xs mt-1">Ex: "Olá", "Ver menu", "Quero uma pizza"</p>
              </div>
            )}
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${
                  msg.direction === 'outbound' ? 'justify-start' : 'justify-end'
                }`}
              >
                <div
                  className={`max-w-[75%] rounded-lg px-3 py-2 ${
                    msg.direction === 'outbound'
                      ? 'bg-muted'
                      : 'bg-primary text-primary-foreground'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.body}</p>
                  <p className={`text-xs mt-1 ${
                    msg.direction === 'outbound'
                      ? 'text-muted-foreground'
                      : 'text-primary-foreground/70'
                  }`}>
                    {format(msg.timestamp, 'HH:mm:ss')}
                  </p>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-lg px-3 py-2">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="p-3 border-t flex gap-2">
          <Textarea
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Digite sua mensagem..."
            className="resize-none text-sm"
            rows={2}
            disabled={isLoading}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendTestMessage();
              }
            }}
          />
          <Button 
            onClick={sendTestMessage} 
            size="icon" 
            className="h-auto"
            disabled={isLoading || !inputMessage.trim()}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </Card>

      {/* State Monitor - Right Side (1 column) */}
      <div className="space-y-4">
        {/* Estado da Conversa */}
        <Card>
          <div className="p-3 border-b flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold text-sm">Estado</h3>
          </div>
          <div className="p-3 space-y-3">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Estado Atual</p>
              <Badge variant="secondary" className="text-xs">
                {conversationState}
              </Badge>
            </div>
            {lastIntent && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Último Intent</p>
                <Badge variant="outline" className="text-xs">
                  {lastIntent}
                </Badge>
              </div>
            )}
            {metadata?.delivery_address && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Endereço</p>
                <p className="text-xs">{metadata.delivery_address}</p>
              </div>
            )}
            {metadata?.payment_method && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Pagamento</p>
                <Badge variant="outline" className="text-xs">
                  {metadata.payment_method}
                </Badge>
              </div>
            )}
          </div>
        </Card>

        {/* Itens Pendentes */}
        {pendingItems.length > 0 && (
          <Card>
            <div className="p-3 border-b flex items-center gap-2">
              <Activity className="h-4 w-4 text-yellow-500" />
              <h3 className="font-semibold text-sm">Pendentes</h3>
              <Badge variant="secondary" className="ml-auto text-xs">
                {pendingItems.length}
              </Badge>
            </div>
            <div className="p-3">
              <div className="space-y-2">
                {pendingItems.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-xs">
                    <span>{item.product_name}</span>
                    <span className="text-muted-foreground">x{item.quantity}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        )}

        {/* Carrinho */}
        <Card>
          <div className="p-3 border-b flex items-center gap-2">
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold text-sm">Carrinho</h3>
            {cartItems.length > 0 && (
              <Badge variant="secondary" className="ml-auto text-xs">
                {cartItems.length}
              </Badge>
            )}
          </div>
          <div className="p-3">
            {cartItems.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-2">
                Carrinho vazio
              </p>
            ) : (
              <div className="space-y-2">
                {cartItems.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-xs border-b pb-2 last:border-0">
                    <div>
                      <span className="font-medium">{item.product_name}</span>
                      <span className="text-muted-foreground ml-1">x{item.quantity}</span>
                    </div>
                    <span className="font-medium">€{(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
                <div className="pt-2 flex justify-between font-semibold text-sm border-t">
                  <span>Total</span>
                  <span>€{cartTotal.toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
