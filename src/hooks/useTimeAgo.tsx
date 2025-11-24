import { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { OrderWithDetails } from '@/types/database';

export function useTimeAgo(date: string) {
  const [timeAgo, setTimeAgo] = useState('');

  useEffect(() => {
    const updateTimeAgo = () => {
      setTimeAgo(formatDistanceToNow(new Date(date), { 
        addSuffix: true,
        locale: ptBR 
      }));
    };

    updateTimeAgo();
    const interval = setInterval(updateTimeAgo, 60000); // Atualiza a cada minuto

    return () => clearInterval(interval);
  }, [date]);

  return timeAgo;
}

export function isOrderUrgent(order: OrderWithDetails): boolean {
  if (order.status !== 'new') return false;
  
  const minutes = (Date.now() - new Date(order.created_at).getTime()) / 1000 / 60;
  return minutes > 30;
}
