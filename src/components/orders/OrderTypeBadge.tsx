import { Badge } from '@/components/ui/badge';
import { Truck, UtensilsCrossed, ShoppingBag } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { OrderType } from '@/types/public-menu';

interface OrderTypeBadgeProps {
  orderType: OrderType;
  tableNumber?: string | null;
  tablePrefix?: string;
  className?: string;
  showIcon?: boolean;
}

const ORDER_TYPE_CONFIG = {
  delivery: {
    label: 'Entrega',
    icon: Truck,
    className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  },
  dine_in: {
    label: 'Na Mesa',
    icon: UtensilsCrossed,
    className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  },
  takeaway: {
    label: 'Take & Go',
    icon: ShoppingBag,
    className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  },
};

export function OrderTypeBadge({
  orderType,
  tableNumber,
  tablePrefix = 'Mesa',
  className,
  showIcon = true,
}: OrderTypeBadgeProps) {
  const config = ORDER_TYPE_CONFIG[orderType] || ORDER_TYPE_CONFIG.delivery;
  const Icon = config.icon;

  let label = config.label;
  if (orderType === 'dine_in' && tableNumber) {
    label = `${tablePrefix} ${tableNumber}`;
  }

  return (
    <Badge className={cn(config.className, className)}>
      {showIcon && <Icon className="h-3 w-3 mr-1" />}
      {label}
    </Badge>
  );
}
