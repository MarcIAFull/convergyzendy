import { useState, useEffect, useRef } from 'react';
import { Send, Bot, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ConversationModeToggle } from './ConversationModeToggle';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface Message {
  id: string;
  body: string;
  direction: string;
  from_number: string;
  to_number: string;
  timestamp: string;
}

interface ChatAreaProps {
  selectedPhone: string;
  customerName: string | null;
  mode: 'ai' | 'manual';
  restaurantId: string;
  onToggleMode: (mode: 'ai' | 'manual') => void;
}

export function ChatArea({ selectedPhone, customerName, mode, restaurantId, onToggleMode }: ChatAreaProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isTogglingMode, setIsTogglingMode] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadMessages();

    const channel = supabase
      .channel('chat-messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;
          if (
            newMsg.from_number === selectedPhone ||
            newMsg.to_number === selectedPhone
          ) {
            setMessages((prev) => [...prev, newMsg]);
          }
        }
      )
      .subscribe();

    return () => {
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
          phoneNumber: selectedPhone,
          message: newMessage.trim(),
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
    <div className="flex flex-col h-full">
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
          const isOutgoing = msg.direction === 'outgoing';
          return (
            <div
              key={msg.id}
              className={cn(
                'flex',
                isOutgoing ? 'justify-end' : 'justify-start'
              )}
            >
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
        {mode === 'ai' && (
          <Alert className="mb-3 bg-primary/10 border-primary/20">
            <Bot className="h-4 w-4 text-primary" />
            <AlertDescription className="text-sm text-primary">
              🤖 A IA está respondendo automaticamente
            </AlertDescription>
          </Alert>
        )}

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
  );
}
