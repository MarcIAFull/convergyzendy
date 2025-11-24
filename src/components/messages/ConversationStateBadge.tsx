import { Badge } from '@/components/ui/badge';
import { conversationStateConfig } from '@/types/conversation';

interface ConversationStateBadgeProps {
  state: string;
}

export function ConversationStateBadge({ state }: ConversationStateBadgeProps) {
  const config = conversationStateConfig[state as keyof typeof conversationStateConfig] || conversationStateConfig.idle;

  return (
    <Badge variant="secondary" className={config.color}>
      {config.label}
    </Badge>
  );
}
