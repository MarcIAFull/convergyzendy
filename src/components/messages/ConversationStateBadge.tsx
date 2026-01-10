import { Badge } from '@/components/ui/badge';
import { conversationStateConfig } from '@/types/conversation';
import { cn } from '@/lib/utils';

interface ConversationStateBadgeProps {
  state: string;
  compact?: boolean;
}

export function ConversationStateBadge({ state, compact }: ConversationStateBadgeProps) {
  const config = conversationStateConfig[state as keyof typeof conversationStateConfig] || conversationStateConfig.idle;

  return (
    <Badge 
      variant="secondary" 
      className={cn(
        config.color,
        compact && "text-[10px] px-1.5 py-0 h-4"
      )}
    >
      {config.label}
    </Badge>
  );
}
