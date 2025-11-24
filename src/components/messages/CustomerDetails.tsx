import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Phone, AlertTriangle, CheckCircle } from 'lucide-react';
import { ConversationStateBadge } from './ConversationStateBadge';
import { LiveCart } from './LiveCart';
import { useTimeAgo } from '@/hooks/useTimeAgo';
import type { CustomerDetails as CustomerDetailsType } from '@/types/conversation';

interface CustomerDetailsProps {
  details: CustomerDetailsType;
}

export function CustomerDetails({ details }: CustomerDetailsProps) {
  const timeAgo = useTimeAgo(details.lastInteraction);
  const displayName = details.name || 'Cliente sem cadastro';
  const initials = details.name
    ? details.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : details.phone.slice(-2);

  const handleContactWhatsApp = () => {
    window.open(`https://wa.me/${details.phone.replace(/\D/g, '')}`, '_blank');
  };

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      {/* Customer Info */}
      <Card>
        <CardHeader>
          <div className="flex flex-col items-center text-center">
            <Avatar className="h-20 w-20 mb-3">
              <AvatarFallback className="bg-primary/10 text-primary text-xl">
                {initials}
              </AvatarFallback>
            </Avatar>
            <CardTitle className="text-xl">{displayName}</CardTitle>
            <p className="text-sm text-muted-foreground">{details.phone}</p>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Status:</span>
            <ConversationStateBadge state={details.conversationState} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Última interação:</span>
            <span className="text-sm font-medium">{timeAgo}</span>
          </div>
          <Button
            variant="outline"
            className="w-full"
            onClick={handleContactWhatsApp}
          >
            <Phone className="h-4 w-4 mr-2" />
            Contatar via WhatsApp
          </Button>
        </CardContent>
      </Card>

      {/* Live Cart */}
      {details.cart && <LiveCart cart={details.cart} />}

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ações Rápidas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button variant="outline" className="w-full justify-start" size="sm">
            <AlertTriangle className="h-4 w-4 mr-2 text-orange-500" />
            Reportar Problema
          </Button>
          <Button variant="outline" className="w-full justify-start" size="sm">
            <CheckCircle className="h-4 w-4 mr-2 text-success" />
            Marcar como Resolvido
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
