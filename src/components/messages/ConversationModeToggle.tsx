import { Bot, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface ConversationModeToggleProps {
  mode: 'ai' | 'manual';
  onToggle: (mode: 'ai' | 'manual') => void;
  disabled?: boolean;
  compact?: boolean;
}

export function ConversationModeToggle({ mode, onToggle, disabled, compact }: ConversationModeToggleProps) {
  if (compact) {
    return (
      <TooltipProvider>
        <div className="flex items-center bg-muted rounded-full p-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                className={cn(
                  'h-7 w-7 rounded-full p-0',
                  mode === 'ai' && 'bg-primary text-primary-foreground hover:bg-primary/90'
                )}
                onClick={() => onToggle('ai')}
                disabled={disabled}
              >
                <Bot className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p className="text-xs">IA responde automaticamente</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                className={cn(
                  'h-7 w-7 rounded-full p-0',
                  mode === 'manual' && 'bg-orange-500 text-white hover:bg-orange-600'
                )}
                onClick={() => onToggle('manual')}
                disabled={disabled}
              >
                <User className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p className="text-xs">Você assume o controle</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <div className="flex items-center gap-1 bg-muted rounded-full p-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              variant={mode === 'ai' ? 'default' : 'ghost'}
              className={cn(
                'h-8 rounded-full px-3',
                mode === 'ai' && 'bg-primary text-primary-foreground'
              )}
              onClick={() => onToggle('ai')}
              disabled={disabled}
            >
              <Bot className="h-4 w-4 mr-1" />
              IA
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>A IA responde automaticamente</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              variant={mode === 'manual' ? 'default' : 'ghost'}
              className={cn(
                'h-8 rounded-full px-3',
                mode === 'manual' && 'bg-orange-500 text-white hover:bg-orange-600'
              )}
              onClick={() => onToggle('manual')}
              disabled={disabled}
            >
              <User className="h-4 w-4 mr-1" />
              Manual
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Você assume o controle da conversa</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
