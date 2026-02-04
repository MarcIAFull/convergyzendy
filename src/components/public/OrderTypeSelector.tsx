import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Truck, UtensilsCrossed, ShoppingBag, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { OrderType } from '@/types/public-menu';

interface OrderTypeSelectorProps {
  selectedType: OrderType;
  onTypeChange: (type: OrderType) => void;
  tableNumber: string;
  onTableNumberChange: (value: string) => void;
  tablePrefix?: string;
  deliveryEnabled?: boolean;
  dineInEnabled?: boolean;
  takeawayEnabled?: boolean;
  requireTableNumber?: boolean;
}

const ORDER_TYPES = [
  {
    id: 'delivery' as OrderType,
    label: 'Entrega',
    icon: Truck,
    description: 'Receba no seu endereço',
  },
  {
    id: 'dine_in' as OrderType,
    label: 'Na Mesa',
    icon: UtensilsCrossed,
    description: 'Consuma no local',
  },
  {
    id: 'takeaway' as OrderType,
    label: 'Take & Go',
    icon: ShoppingBag,
    description: 'Retire no balcão',
  },
];

export function OrderTypeSelector({
  selectedType,
  onTypeChange,
  tableNumber,
  onTableNumberChange,
  tablePrefix = 'Mesa',
  deliveryEnabled = true,
  dineInEnabled = false,
  takeawayEnabled = false,
  requireTableNumber = true,
}: OrderTypeSelectorProps) {
  const availableTypes = ORDER_TYPES.filter((type) => {
    if (type.id === 'delivery') return deliveryEnabled;
    if (type.id === 'dine_in') return dineInEnabled;
    if (type.id === 'takeaway') return takeawayEnabled;
    return false;
  });

  // If only one option is available, don't show selector
  if (availableTypes.length <= 1) {
    return null;
  }

  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold mb-4">Como deseja receber seu pedido?</h2>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        {availableTypes.map((type) => {
          const Icon = type.icon;
          const isSelected = selectedType === type.id;

          return (
            <button
              key={type.id}
              type="button"
              onClick={() => onTypeChange(type.id)}
              className={cn(
                'flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all',
                isSelected
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-border hover:border-primary/50 hover:bg-muted/50'
              )}
            >
              <Icon className={cn('h-6 w-6', isSelected ? 'text-primary' : 'text-muted-foreground')} />
              <span className="font-medium text-sm">{type.label}</span>
              <span className="text-xs text-muted-foreground text-center">{type.description}</span>
            </button>
          );
        })}
      </div>

      {/* Table number input for dine-in */}
      {selectedType === 'dine_in' && (
        <div className="space-y-3 pt-4 border-t">
          <div>
            <Label htmlFor="table_number">Número da {tablePrefix} *</Label>
            <Input
              id="table_number"
              value={tableNumber}
              onChange={(e) => onTableNumberChange(e.target.value)}
              placeholder="12"
              required={requireTableNumber}
              className="mt-1"
            />
          </div>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Indique o número da sua mesa para entregarmos o pedido
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* Take & Go info */}
      {selectedType === 'takeaway' && (
        <div className="pt-4 border-t">
          <Alert>
            <ShoppingBag className="h-4 w-4" />
            <AlertDescription>
              Retire o seu pedido no balcão quando estiver pronto
            </AlertDescription>
          </Alert>
        </div>
      )}
    </Card>
  );
}
