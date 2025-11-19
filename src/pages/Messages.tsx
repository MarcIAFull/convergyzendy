import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Send, Phone } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface Message {
  id: string;
  body: string;
  direction: string;
  from_number: string;
  to_number: string;
  timestamp: string;
  restaurant_id: string;
}

interface Conversation {
  userPhone: string;
  lastMessage: string;
  lastTimestamp: string;
  unreadCount: number;
}

export default function Messages() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadRestaurantAndConversations();
    
    const channel = supabase
      .channel('messages-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages'
        },
        () => {
          loadRestaurantAndConversations();
          if (selectedPhone) {
            loadMessages(selectedPhone);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedPhone]);

  const loadRestaurantAndConversations = async () => {
    // For single-tenant MVP, just get the first restaurant
    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('id')
      .limit(1)
      .single();

    if (restaurant) {
      setRestaurantId(restaurant.id);
      loadConversations(restaurant.id);
    }
  };

  const loadConversations = async (restId: string) => {
    const { data: allMessages } = await supabase
      .from('messages')
      .select('*')
      .eq('restaurant_id', restId)
      .order('timestamp', { ascending: false });

    if (!allMessages) return;

    const conversationsMap = new Map<string, Conversation>();
    
    allMessages.forEach((msg) => {
      const userPhone = msg.direction === 'inbound' ? msg.from_number : msg.to_number;
      
      if (!conversationsMap.has(userPhone)) {
        conversationsMap.set(userPhone, {
          userPhone,
          lastMessage: msg.body,
          lastTimestamp: msg.timestamp,
          unreadCount: msg.direction === 'inbound' ? 1 : 0
        });
      }
    });

    setConversations(Array.from(conversationsMap.values()));
  };

  const loadMessages = async (phone: string) => {
    if (!restaurantId) return;

    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .or(`from_number.eq.${phone},to_number.eq.${phone}`)
      .order('timestamp', { ascending: true });

    if (data) {
      setMessages(data);
    }
  };

  const handleConversationClick = (phone: string) => {
    setSelectedPhone(phone);
    loadMessages(phone);
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedPhone || !restaurantId) return;

    try {
      await supabase.functions.invoke('whatsapp-send', {
        body: {
          restaurantId,
          customerPhone: selectedPhone,
          messageText: newMessage
        }
      });

      setNewMessage("");
      toast({
        title: "Mensagem enviada",
        description: "A mensagem foi enviada com sucesso"
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível enviar a mensagem",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] gap-4 p-6">
      {/* Conversations List */}
      <Card className="w-80 flex flex-col">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">Conversas</h2>
        </div>
        <ScrollArea className="flex-1">
          {conversations.map((conv) => (
            <button
              key={conv.userPhone}
              onClick={() => handleConversationClick(conv.userPhone)}
              className={`w-full p-4 border-b hover:bg-accent transition-colors flex items-start gap-3 ${
                selectedPhone === conv.userPhone ? 'bg-accent' : ''
              }`}
            >
              <Avatar>
                <AvatarFallback className="bg-primary text-primary-foreground">
                  <Phone className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 text-left overflow-hidden">
                <div className="font-medium truncate">{conv.userPhone}</div>
                <div className="text-sm text-muted-foreground truncate">
                  {conv.lastMessage}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {format(new Date(conv.lastTimestamp), 'dd/MM HH:mm')}
                </div>
              </div>
            </button>
          ))}
        </ScrollArea>
      </Card>

      {/* Messages Thread */}
      <Card className="flex-1 flex flex-col">
        {selectedPhone ? (
          <>
            <div className="p-4 border-b flex items-center gap-3">
              <Avatar>
                <AvatarFallback className="bg-primary text-primary-foreground">
                  <Phone className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="font-medium">{selectedPhone}</div>
              </div>
            </div>

            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${
                      msg.direction === 'outbound' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <div
                      className={`max-w-[70%] rounded-lg px-4 py-2 ${
                        msg.direction === 'outbound'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{msg.body}</p>
                      <p className={`text-xs mt-1 ${
                        msg.direction === 'outbound'
                          ? 'text-primary-foreground/70'
                          : 'text-muted-foreground'
                      }`}>
                        {format(new Date(msg.timestamp), 'HH:mm')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <div className="p-4 border-t flex gap-2">
              <Textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Digite sua mensagem..."
                className="resize-none"
                rows={2}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
              />
              <Button onClick={handleSendMessage} size="icon" className="h-auto">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            Selecione uma conversa para começar
          </div>
        )}
      </Card>
    </div>
  );
}
