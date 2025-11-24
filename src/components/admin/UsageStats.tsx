import { useEffect } from 'react';
import { useSubscriptionStore } from '@/stores/subscriptionStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

interface UsageStatsProps {
  restaurantId: string;
}

const UsageStats = ({ restaurantId }: UsageStatsProps) => {
  const { usageLogs, loading, fetchUsageLogs } = useSubscriptionStore();

  useEffect(() => {
    if (restaurantId) {
      fetchUsageLogs(restaurantId);
    }
  }, [restaurantId, fetchUsageLogs]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  const getEventTypeLabel = (type: string) => {
    switch (type) {
      case 'order_created': return 'Pedido Criado';
      case 'user_added': return 'Utilizador Adicionado';
      case 'message_sent': return 'Mensagem Enviada';
      default: return type;
    }
  };

  const getEventTypeColor = (type: string) => {
    switch (type) {
      case 'order_created': return 'bg-green-500';
      case 'user_added': return 'bg-blue-500';
      case 'message_sent': return 'bg-purple-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Histórico de Utilização</CardTitle>
        <CardDescription>
          Últimas 100 atividades registadas no sistema
        </CardDescription>
      </CardHeader>
      <CardContent>
        {usageLogs.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            Nenhum registo de utilização encontrado
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Evento</TableHead>
                <TableHead>Quantidade</TableHead>
                <TableHead>Detalhes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usageLogs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>
                    {new Date(log.created_at || '').toLocaleString('pt-PT')}
                  </TableCell>
                  <TableCell>
                    <Badge className={getEventTypeColor(log.event_type)}>
                      {getEventTypeLabel(log.event_type)}
                    </Badge>
                  </TableCell>
                  <TableCell>{log.quantity || 1}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {log.metadata && typeof log.metadata === 'object' 
                      ? JSON.stringify(log.metadata).substring(0, 50) + '...'
                      : '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

export default UsageStats;
