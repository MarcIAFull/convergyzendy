import { Search, Bot, User } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
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
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar conversas..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filteredConversations.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <p>Nenhuma conversa encontrada</p>
          </div>
        ) : (
          <div className="p-2">
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

  return (
    <Card
      className={cn(
        'mb-2 cursor-pointer transition-all hover:bg-accent/50',
        isSelected && 'bg-accent border-l-4 border-l-primary'
      )}
      onClick={onClick}
    >
      <div className="p-3">
        <div className="flex items-start gap-3">
          <Avatar className="h-10 w-10">
            <AvatarFallback className="bg-primary/10 text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1">
              <p className="font-semibold text-sm truncate">{displayName}</p>
              <div className="flex items-center gap-1">
                {conversation.mode === 'ai' ? (
                  <Bot className="h-3 w-3 text-primary" />
                ) : (
                  <User className="h-3 w-3 text-orange-500" />
                )}
              </div>
            </div>

            <p className="text-xs text-muted-foreground truncate mb-2">
              {conversation.lastMessage}
            </p>

            <div className="flex items-center gap-2 flex-wrap">
              <ConversationStateBadge state={conversation.conversationState} />
              {conversation.hasActiveCart && (
                <Badge variant="outline" className="text-xs">
                  🛒 Carrinho
                </Badge>
              )}
              <span className="text-xs text-muted-foreground ml-auto">{timeAgo}</span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
