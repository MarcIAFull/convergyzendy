import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Bot, Loader2, User, Info, ChevronUp } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ConversationModeToggle } from './ConversationModeToggle';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import type { CartWithItems } from '@/types/conversation';

const MESSAGES_PER_PAGE = 20;

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
  onShowDetails?: () => void;
}

export function ChatArea({ selectedPhone, customerName, mode, restaurantId, onToggleMode, cart, onShowDetails }: ChatAreaProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isTogglingMode, setIsTogglingMode] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const isInitialLoad = useRef(true);
  const { toast } = useToast();

  // Load initial messages (last N)
  const loadInitialMessages = useCallback(async () => {
    isInitialLoad.current = true;
    
    // First get total count
    const { count } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('restaurant_id', restaurantId)
      .or(`from_number.eq.${selectedPhone},to_number.eq.${selectedPhone}`);
    
    setTotalCount(count || 0);
    
    // Then get last N messages
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .or(`from_number.eq.${selectedPhone},to_number.eq.${selectedPhone}`)
      .order('timestamp', { ascending: false })
      .limit(MESSAGES_PER_PAGE);

    if (error) {
      console.error('Error loading messages:', error);
      return;
    }

    const sortedMessages = (data || []).reverse();
    setMessages(sortedMessages);
    setHasMoreMessages((count || 0) > MESSAGES_PER_PAGE);
  }, [restaurantId, selectedPhone]);

  // Load more messages when scrolling up
  const loadMoreMessages = useCallback(async () => {
    if (isLoadingMore || !hasMoreMessages || messages.length === 0) return;
    
    setIsLoadingMore(true);
    const container = messagesContainerRef.current;
    const previousScrollHeight = container?.scrollHeight || 0;
    
    // Get oldest message timestamp we have
    const oldestTimestamp = messages[0]?.timestamp;
    
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .or(`from_number.eq.${selectedPhone},to_number.eq.${selectedPhone}`)
      .lt('timestamp', oldestTimestamp)
      .order('timestamp', { ascending: false })
      .limit(MESSAGES_PER_PAGE);

    if (error) {
      console.error('Error loading more messages:', error);
      setIsLoadingMore(false);
      return;
    }

    const olderMessages = (data || []).reverse();
    
    if (olderMessages.length < MESSAGES_PER_PAGE) {
      setHasMoreMessages(false);
    }
    
    if (olderMessages.length > 0) {
      setMessages(prev => [...olderMessages, ...prev]);
      
      // Maintain scroll position after prepending
      requestAnimationFrame(() => {
        if (container) {
          const newScrollHeight = container.scrollHeight;
          container.scrollTop = newScrollHeight - previousScrollHeight;
        }
      });
    }
    
    setIsLoadingMore(false);
  }, [isLoadingMore, hasMoreMessages, messages, restaurantId, selectedPhone]);

  // Handle scroll to detect when user scrolls to top
  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    
    // If scrolled near top (within 50px), load more
    if (container.scrollTop < 50 && hasMoreMessages && !isLoadingMore) {
      loadMoreMessages();
    }
  }, [hasMoreMessages, isLoadingMore, loadMoreMessages]);

  useEffect(() => {
    loadInitialMessages();

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
            setTotalCount(prev => prev + 1);
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
  }, [selectedPhone, restaurantId, loadInitialMessages]);

  // Scroll to bottom on initial load and new messages
  useEffect(() => {
    if (isInitialLoad.current && messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
      isInitialLoad.current = false;
    } else if (!isInitialLoad.current && messages.length > 0) {
      // Only scroll on new messages (not when loading older)
      const container = messagesContainerRef.current;
      if (container) {
        const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
        if (isNearBottom) {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
      }
    }
  }, [messages]);

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
        title: newMode === 'manual' ? '👤 Modo Manual' : '🤖 Modo IA',
        description: newMode === 'manual' 
          ? 'Você está no controle' 
          : 'IA responderá automaticamente',
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
  const cartItemCount = cart?.items?.length || 0;
  const loadedCount = messages.length;

  return (
    <div className="flex flex-col h-full">
      {/* Compact Header */}
      <div className="border-b border-border px-4 py-3 flex-shrink-0">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="min-w-0">
              <h2 className="font-semibold text-sm truncate">{displayName}</h2>
              <p className="text-xs text-muted-foreground truncate">{selectedPhone}</p>
            </div>
            
            {/* Inline Manual Mode Badge */}
            {mode === 'manual' && (
              <Badge variant="outline" className="border-orange-500 text-orange-600 bg-orange-500/10 text-xs flex-shrink-0">
                ⚠️ Manual
              </Badge>
            )}
          </div>
          
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Cart indicator */}
            {cartItemCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                🛒 {cartItemCount}
              </Badge>
            )}
            
            <ConversationModeToggle
              mode={mode}
              onToggle={handleToggleMode}
              disabled={isTogglingMode}
              compact
            />
            
            {onShowDetails && (
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8"
                onClick={onShowDetails}
              >
                <Info className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Messages - Fixed height container with scroll */}
      <div 
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2"
      >
        {/* Load More - Simple top indicator */}
        {hasMoreMessages && (
          <div className="text-center py-1">
            {isLoadingMore ? (
              <Loader2 className="h-4 w-4 animate-spin mx-auto text-muted-foreground" />
            ) : (
              <span className="text-xs text-muted-foreground">
                ↑ Scroll para carregar mais
              </span>
            )}
          </div>
        )}

        {messages.map((msg) => {
          const isOutgoing = msg.direction === 'outbound';
          return (
            <div
              key={msg.id}
              className={cn(
                'flex flex-col max-w-[85%]',
                isOutgoing ? 'ml-auto items-end' : 'mr-auto items-start'
              )}
            >
              <div
                className={cn(
                  'rounded-2xl px-3 py-2 relative',
                  isOutgoing
                    ? 'bg-primary text-primary-foreground rounded-br-md'
                    : 'bg-muted rounded-bl-md'
                )}
              >
                <p className="text-sm break-words whitespace-pre-wrap">{msg.body}</p>
                <div className={cn(
                  'flex items-center gap-1 mt-1',
                  isOutgoing ? 'justify-end' : 'justify-start'
                )}>
                  {/* Sender indicator */}
                  {isOutgoing && msg.sent_by && (
                    msg.sent_by === 'ai' ? (
                      <Bot className="h-3 w-3 opacity-60" />
                    ) : msg.sent_by === 'human' ? (
                      <User className="h-3 w-3 opacity-60" />
                    ) : null
                  )}
                  <span
                    className={cn(
                      'text-[10px]',
                      isOutgoing ? 'text-primary-foreground/60' : 'text-muted-foreground'
                    )}
                  >
                    {format(new Date(msg.timestamp), 'HH:mm')}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Compact Footer */}
      <div className="border-t border-border p-3 flex-shrink-0">
        <div className="flex gap-2">
          <Input
            placeholder={mode === 'ai' ? 'Ative Manual para enviar' : 'Digite sua mensagem...'}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            disabled={mode === 'ai' || isSending}
            className="text-sm"
          />
          <Button
            onClick={handleSendMessage}
            disabled={mode === 'ai' || isSending || !newMessage.trim()}
            size="icon"
            className="flex-shrink-0"
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