import { useState, useEffect, useRef } from 'react';
import { Send, Bot, Loader2, User } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ConversationModeToggle } from './ConversationModeToggle';
import { LiveCart } from './LiveCart';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import type { CartWithItems } from '@/types/conversation';

interface Message {
  id: string;
  body: string;
  direction: string;
  from_number: string;
  to_number: string;
  timestamp: string;
  sent_by?: string | null;
}

interface ChatAreaProps {
  selectedPhone: string;
  customerName: string | null;
  mode: 'ai' | 'manual';
  restaurantId: string;
  onToggleMode: (mode: 'ai' | 'manual') => void;
  cart?: CartWithItems | null;
}

export function ChatArea({ selectedPhone, customerName, mode, restaurantId, onToggleMode, cart }: ChatAreaProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isTogglingMode, setIsTogglingMode] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadMessages();

    // Create unique channel name per conversation
    const channelName = `chat-messages-${restaurantId}-${selectedPhone.replace(/\+/g, '')}`;
    console.log('[ChatArea] Setting up realtime subscription:', channelName);

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        (payload) => {
          console.log('[ChatArea] New message received:', payload);
          const newMsg = payload.new as Message;
          if (
            newMsg.from_number === selectedPhone ||
            newMsg.to_number === selectedPhone
          ) {
            setMessages((prev) => [...prev, newMsg]);
          }
        }
      )
      .subscribe((status) => {
        console.log('[ChatArea] Subscription status:', status);
      });

    return () => {
      console.log('[ChatArea] Cleaning up subscription:', channelName);
      supabase.removeChannel(channel);
    };
  }, [selectedPhone, restaurantId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadMessages = async () => {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .or(`from_number.eq.${selectedPhone},to_number.eq.${selectedPhone}`)
      .order('timestamp', { ascending: true });

    if (error) {
      console.error('Error loading messages:', error);
      return;
    }

    setMessages(data || []);
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || isSending) return;

    setIsSending(true);
    try {
    const { error } = await supabase.functions.invoke('whatsapp-send', {
      body: {
        restaurantId,
        customerPhone: selectedPhone,
        messageText: newMessage.trim(),
      },
    });

      if (error) throw error;

      setNewMessage('');
      toast({
        title: '✅ Mensagem enviada',
        description: 'Sua mensagem foi enviada com sucesso',
      });
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        variant: 'destructive',
        title: '❌ Erro ao enviar',
        description: 'Não foi possível enviar a mensagem',
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleToggleMode = async (newMode: 'ai' | 'manual') => {
    setIsTogglingMode(true);
    try {
      await onToggleMode(newMode);
      toast({
        title: newMode === 'manual' ? '👤 Modo Manual Ativado' : '🤖 Modo IA Ativado',
        description: newMode === 'manual' 
          ? 'Você está no controle da conversa' 
          : 'A IA responderá automaticamente',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: '❌ Erro ao alterar modo',
        description: 'Tente novamente',
      });
    } finally {
      setIsTogglingMode(false);
    }
  };

  const displayName = customerName || selectedPhone;

  return (
    <div className="flex h-full">
      {/* Main Chat Area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Alerta Fixo de Atenção */}
        {mode === 'manual' && (
          <Alert className="m-4 mb-0 border-2 border-orange-500 bg-orange-500/10">
            <User className="h-5 w-5 text-orange-500" />
            <AlertDescription className="text-sm font-medium text-orange-500 flex items-center justify-between">
              <div>
                <span className="font-bold">⚠️ MODO MANUAL ATIVO</span>
                <p className="text-xs mt-1 text-orange-600">Você está no controle desta conversa. A IA não responderá automaticamente.</p>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Header */}
        <div className="border-b border-border p-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-lg">{displayName}</h2>
              <p className="text-sm text-muted-foreground">{selectedPhone}</p>
            </div>
            <ConversationModeToggle
              mode={mode}
              onToggle={handleToggleMode}
              disabled={isTogglingMode}
            />
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((msg) => {
            const isOutgoing = msg.direction === 'outbound';
            return (
              <div
                key={msg.id}
                className={cn(
                  'flex flex-col',
                  isOutgoing ? 'items-end' : 'items-start'
                )}
              >
                {/* Badge indicating origin (only for outbound messages) */}
                {isOutgoing && msg.sent_by && (
                  <div className="flex items-center gap-1 mb-1 px-2">
                    {msg.sent_by === 'ai' ? (
                      <>
                        <Bot className="h-3 w-3 text-primary" />
                        <span className="text-xs text-muted-foreground font-medium">IA</span>
                      </>
                    ) : msg.sent_by === 'human' ? (
                      <>
                        <User className="h-3 w-3 text-blue-600" />
                        <span className="text-xs text-muted-foreground font-medium">Você</span>
                      </>
                    ) : null}
                  </div>
                )}
                
                <Card
                  className={cn(
                    'max-w-[70%] p-3',
                    isOutgoing
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  )}
                >
                  <p className="text-sm break-words">{msg.body}</p>
                  <p
                    className={cn(
                      'text-xs mt-1',
                      isOutgoing ? 'text-primary-foreground/70' : 'text-muted-foreground'
                    )}
                  >
                    {format(new Date(msg.timestamp), 'HH:mm')}
                  </p>
                </Card>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Footer */}
        <div className="border-t border-border p-4">
          <div className="flex gap-2">
            <Input
              placeholder={mode === 'ai' ? 'Assumir controle para enviar mensagem' : 'Digite sua mensagem...'}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              disabled={mode === 'ai' || isSending}
            />
            <Button
              onClick={handleSendMessage}
              disabled={mode === 'ai' || isSending || !newMessage.trim()}
            >
              {isSending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* LiveCart Sidebar - Shows when cart has items */}
      {cart && cart.items && cart.items.length > 0 && (
        <div className="w-80 border-l border-border p-4 overflow-y-auto hidden lg:block">
          <LiveCart cart={cart} />
        </div>
      )}
    </div>
  );
}
