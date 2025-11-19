import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Send, RefreshCw, Database, MessageSquare } from "lucide-react";
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
  addons: Array<{ name: string; price: number }>;
}

interface OrderState {
  state: string;
  cart: CartItem[];
  delivery_address?: string;
  payment_method?: string;
}

export default function TestWhatsApp() {
  const [messages, setMessages] = useState<TestMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [testPhone] = useState("+351912345678");
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [orderState, setOrderState] = useState<OrderState | null>(null);
  const { toast } = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadRestaurant();
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const loadRestaurant = async () => {
    // For single-tenant MVP, just get the first restaurant
    const { data: restaurant, error } = await supabase
      .from('restaurants')
      .select('id, phone')
      .limit(1)
      .single();

    if (error || !restaurant) {
      toast({
        title: "Nenhum restaurante encontrado",
        description: "Por favor crie um restaurante primeiro na página Settings",
        variant: "destructive"
      });
      return;
    }

    setRestaurantId(restaurant.id);
    toast({
      title: "Restaurante carregado",
      description: `Teste com número: ${testPhone}`
    });
  };

  const sendTestMessage = async () => {
    if (!inputMessage.trim() || !restaurantId || isLoading) return;

    setIsLoading(true);
    const userMessage: TestMessage = {
      id: Date.now().toString(),
      body: inputMessage,
      direction: 'inbound',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage("");

    try {
      // Call the AI agent directly
      const { data, error } = await supabase.functions.invoke('whatsapp-ai-agent', {
        body: {
          restaurantId,
          customerPhone: testPhone,
          messageBody: inputMessage
        }
      });

      if (error) throw error;

      console.log('AI Response:', data);

      // Extract response and state
      if (data.response) {
        const aiMessage: TestMessage = {
          id: (Date.now() + 1).toString(),
          body: data.response,
          direction: 'outbound',
          timestamp: new Date()
        };
        setMessages(prev => [...prev, aiMessage]);
      }

      // Update order state with all response data
      if (data) {
        setOrderState({
          state: data.state || 'idle',
          cart: data.cart || [],
          delivery_address: data.delivery_address,
          payment_method: data.payment_method,
        });
      }

      toast({
        title: "Mensagem enviada",
        description: "Resposta do AI recebida"
      });
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

  const clearTest = () => {
    setMessages([]);
    setOrderState(null);
    toast({
      title: "Teste resetado",
      description: "Conversa limpa"
    });
  };

  const checkDatabase = async () => {
    if (!restaurantId) return;

    const { data: orders } = await supabase
      .from('orders')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('user_phone', testPhone)
      .order('created_at', { ascending: false })
      .limit(1);

    const { data: dbMessages } = await supabase
      .from('messages')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .or(`from_number.eq.${testPhone},to_number.eq.${testPhone}`)
      .order('timestamp', { ascending: false })
      .limit(10);

    toast({
      title: "Verificação da BD",
      description: `${orders?.length || 0} pedidos, ${dbMessages?.length || 0} mensagens`,
    });

    console.log('Orders:', orders);
    console.log('Messages:', dbMessages);
  };

  return (
    <div className="flex gap-4 p-6 h-[calc(100vh-4rem)]">
      {/* Chat Simulator */}
      <Card className="flex-1 flex flex-col">
        <div className="p-4 border-b flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Simulador WhatsApp</h2>
            <p className="text-sm text-muted-foreground">Cliente: {testPhone}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={checkDatabase}>
              <Database className="h-4 w-4 mr-2" />
              Ver BD
            </Button>
            <Button variant="outline" size="sm" onClick={clearTest}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Limpar
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          <div className="space-y-4">
            {messages.length === 0 && (
              <div className="text-center text-muted-foreground py-8">
                <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Envie uma mensagem para começar o teste</p>
                <p className="text-sm mt-2">Exemplos: "Olá", "Ver menu", "Quero uma pizza"</p>
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
                  className={`max-w-[80%] rounded-lg px-4 py-2 ${
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
                <div className="bg-muted rounded-lg px-4 py-2">
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

        <div className="p-4 border-t flex gap-2">
          <Textarea
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Digite sua mensagem de teste..."
            className="resize-none"
            rows={2}
            disabled={isLoading || !restaurantId}
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
            disabled={isLoading || !restaurantId || !inputMessage.trim()}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </Card>

      {/* State Monitor */}
      <Card className="w-96 flex flex-col">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">Estado da Conversa</h2>
        </div>

        <ScrollArea className="flex-1 p-4">
          {orderState ? (
            <div className="space-y-4">
              {/* Current State */}
              <div>
                <h3 className="font-medium mb-2">Estado Atual</h3>
                <Badge variant="secondary" className="text-sm">
                  {orderState.state}
                </Badge>
              </div>

              {/* Cart */}
              {orderState.cart && orderState.cart.length > 0 && (
                <div>
                  <h3 className="font-medium mb-2">Carrinho ({orderState.cart.length})</h3>
                  <div className="space-y-2">
                    {orderState.cart.map((item, idx) => (
                      <Card key={idx} className="p-3">
                        <div className="flex justify-between mb-1">
                          <span className="font-medium">{item.product_name}</span>
                          <span className="text-sm">x{item.quantity}</span>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          €{item.price.toFixed(2)}
                        </div>
                        {item.addons && item.addons.length > 0 && (
                          <div className="text-xs text-muted-foreground mt-1">
                            + {item.addons.map(a => a.name).join(', ')}
                          </div>
                        )}
                      </Card>
                    ))}
                    <div className="pt-2 border-t">
                      <div className="flex justify-between font-semibold">
                        <span>Total</span>
                        <span>
                          €{orderState.cart.reduce((sum, item) => {
                            const itemTotal = item.price * item.quantity;
                            const addonsTotal = item.addons?.reduce((s, a) => s + a.price, 0) || 0;
                            return sum + itemTotal + addonsTotal;
                          }, 0).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Delivery Address */}
              {orderState.delivery_address && (
                <div>
                  <h3 className="font-medium mb-2">Morada de Entrega</h3>
                  <Card className="p-3">
                    <p className="text-sm">{orderState.delivery_address}</p>
                  </Card>
                </div>
              )}

              {/* Payment Method */}
              {orderState.payment_method && (
                <div>
                  <h3 className="font-medium mb-2">Método de Pagamento</h3>
                  <Card className="p-3">
                    <p className="text-sm capitalize">{orderState.payment_method}</p>
                  </Card>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-8">
              <p>Nenhum estado ativo</p>
              <p className="text-sm mt-2">Inicie uma conversa para ver o estado</p>
            </div>
          )}
        </ScrollArea>
      </Card>
    </div>
  );
}
