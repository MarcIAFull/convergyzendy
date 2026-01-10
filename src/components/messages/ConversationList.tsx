import { Search, Bot, User, ShoppingCart } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ConversationStateBadge } from './ConversationStateBadge';
import { cn } from '@/lib/utils';
import { useTimeAgo } from '@/hooks/useTimeAgo';
import type { EnrichedConversation } from '@/types/conversation';
import { useState } from 'react';

interface ConversationListProps {
  conversations: EnrichedConversation[];
  selectedPhone: string | null;
  onSelectConversation: (phone: string) => void;
}

export function ConversationList({ conversations, selectedPhone, onSelectConversation }: ConversationListProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredConversations = conversations.filter(conv => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      conv.userPhone.includes(query) ||
      conv.customerName?.toLowerCase().includes(query) ||
      conv.lastMessage.toLowerCase().includes(query)
    );
  });

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="p-3 border-b border-border flex-shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {filteredConversations.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground text-sm">
            <p>Nenhuma conversa encontrada</p>
          </div>
        ) : (
          <div className="py-1">
            {filteredConversations.map((conv) => (
              <ConversationCard
                key={conv.userPhone}
                conversation={conv}
                isSelected={conv.userPhone === selectedPhone}
                onClick={() => onSelectConversation(conv.userPhone)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface ConversationCardProps {
  conversation: EnrichedConversation;
  isSelected: boolean;
  onClick: () => void;
}

function ConversationCard({ conversation, isSelected, onClick }: ConversationCardProps) {
  const timeAgo = useTimeAgo(conversation.lastTimestamp);
  const displayName = conversation.customerName || conversation.userPhone;
  const initials = conversation.customerName
    ? conversation.customerName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : conversation.userPhone.slice(-2);

  // Detect if needs attention
  const needsAttention = conversation.mode === 'manual';
  const unreadCount = conversation.unreadCount || 0;

  return (
    <div
      className={cn(
        'px-3 py-2.5 cursor-pointer transition-colors relative border-l-2',
        isSelected 
          ? 'bg-accent border-l-primary' 
          : 'hover:bg-accent/50 border-l-transparent',
        needsAttention && !isSelected && 'bg-orange-500/5 border-l-orange-500'
      )}
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="relative flex-shrink-0">
          <Avatar className={cn(
            "h-10 w-10",
            needsAttention && "ring-2 ring-orange-500"
          )}>
            <AvatarFallback className={cn(
              "text-xs",
              needsAttention ? "bg-orange-500/20 text-orange-600" : "bg-primary/10 text-primary"
            )}>
              {initials}
            </AvatarFallback>
          </Avatar>
          
          {/* Unread badge */}
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
          
          {/* Mode indicator */}
          <span className={cn(
            "absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full flex items-center justify-center",
            conversation.mode === 'ai' 
              ? "bg-primary text-primary-foreground" 
              : "bg-orange-500 text-white"
          )}>
            {conversation.mode === 'ai' ? (
              <Bot className="h-2.5 w-2.5" />
            ) : (
              <User className="h-2.5 w-2.5" />
            )}
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Name + Time row */}
          <div className="flex items-center justify-between gap-2">
            <span className={cn(
              "text-sm font-medium truncate",
              unreadCount > 0 && "font-semibold"
            )}>
              {displayName}
            </span>
            <span className="text-[10px] text-muted-foreground flex-shrink-0">
              {timeAgo}
            </span>
          </div>

          {/* Last message */}
          <p className={cn(
            "text-xs text-muted-foreground truncate mt-0.5",
            unreadCount > 0 && "text-foreground font-medium"
          )}>
            {conversation.lastMessage}
          </p>

          {/* Badges row */}
          <div className="flex items-center gap-1.5 mt-1.5">
            <ConversationStateBadge state={conversation.conversationState} compact />
            {conversation.hasActiveCart && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                <ShoppingCart className="h-2.5 w-2.5 mr-0.5" />
                Carrinho
              </Badge>
            )}
            {needsAttention && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-orange-500 text-orange-600 bg-orange-500/10">
                Atenção
              </Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
