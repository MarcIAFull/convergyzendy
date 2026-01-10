import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Phone, AlertTriangle, CheckCircle, ExternalLink } from 'lucide-react';
import { ConversationStateBadge } from './ConversationStateBadge';
import { LiveCart } from './LiveCart';
import { useTimeAgo } from '@/hooks/useTimeAgo';
import { useToast } from '@/hooks/use-toast';
import type { CustomerDetails as CustomerDetailsType } from '@/types/conversation';

interface CustomerDetailsProps {
  details: CustomerDetailsType;
  restaurantId?: string;
}

export function CustomerDetails({ details, restaurantId }: CustomerDetailsProps) {
  const timeAgo = useTimeAgo(details.lastInteraction);
  const { toast } = useToast();
  const displayName = details.name || 'Cliente sem cadastro';
  const initials = details.name
    ? details.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : details.phone.slice(-2);

  const handleContactWhatsApp = () => {
    window.open(`https://wa.me/${details.phone.replace(/\D/g, '')}`, '_blank');
  };

  const handleReportProblem = () => {
    toast({
      title: '🚧 Em desenvolvimento',
      description: 'Esta funcionalidade estará disponível em breve',
    });
  };

  const handleMarkResolved = () => {
    toast({
      title: '🚧 Em desenvolvimento',
      description: 'Esta funcionalidade estará disponível em breve',
    });
  };

  return (
    <div className="h-full overflow-y-auto">
      {/* Customer Header - Compact */}
      <div className="p-4 flex items-center gap-3 border-b border-border">
        <Avatar className="h-12 w-12 flex-shrink-0">
          <AvatarFallback className="bg-primary/10 text-primary text-base">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-sm truncate">{displayName}</h3>
          <p className="text-xs text-muted-foreground truncate">{details.phone}</p>
          <div className="flex items-center gap-2 mt-1">
            <ConversationStateBadge state={details.conversationState} />
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Última interação</span>
          <span className="font-medium">{timeAgo}</span>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="p-4 space-y-2 border-b border-border">
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start"
          onClick={handleContactWhatsApp}
        >
          <ExternalLink className="h-4 w-4 mr-2" />
          Abrir WhatsApp
        </Button>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1 text-orange-600 border-orange-200 hover:bg-orange-50"
            onClick={handleReportProblem}
          >
            <AlertTriangle className="h-3 w-3 mr-1" />
            Problema
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1 text-green-600 border-green-200 hover:bg-green-50"
            onClick={handleMarkResolved}
          >
            <CheckCircle className="h-3 w-3 mr-1" />
            Resolvido
          </Button>
        </div>
      </div>

      {/* Live Cart */}
      {details.cart && details.cart.items && details.cart.items.length > 0 && (
        <div className="p-4">
          <LiveCart cart={details.cart} restaurantId={restaurantId} customerPhone={details.phone} />
        </div>
      )}

      {/* Empty state when no cart */}
      {(!details.cart || !details.cart.items || details.cart.items.length === 0) && (
        <div className="p-4 text-center text-muted-foreground text-sm">
          <p>Nenhum carrinho ativo</p>
        </div>
      )}
    </div>
  );
}
