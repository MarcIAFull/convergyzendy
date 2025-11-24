import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { OrderWithDetails } from '@/types/database';
import { Badge } from '@/components/ui/badge';

interface PrintableOrderProps {
  order: OrderWithDetails;
}

export function PrintableOrder({ order }: PrintableOrderProps) {
  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      new: 'Novo',
      preparing: 'Preparando',
      out_for_delivery: 'Saiu p/ Entrega',
      completed: 'Concluído',
      cancelled: 'Cancelado',
    };
    return labels[status] || status;
  };

  const calculateItemTotal = (item: typeof order.items[0]) => {
    const basePrice = item.product.price * item.quantity;
    const addonsPrice = item.addons.reduce((sum, addon) => sum + addon.price, 0) * item.quantity;
    return basePrice + addonsPrice;
  };

  const subtotal = order.items.reduce((sum, item) => sum + calculateItemTotal(item), 0);
  const deliveryFee = order.total_amount - subtotal;

  const customerName = order.customer?.name || order.user_phone;

  return (
    <div id="printable-order" className="hidden print:block">
      <div className="p-8 max-w-sm mx-auto font-mono text-black">
        {/* Cabeçalho */}
        <div className="text-center mb-6 border-b-2 border-dashed border-black pb-4">
          <h1 className="text-2xl font-bold mb-2">PEDIDO #{order.id.slice(0, 8).toUpperCase()}</h1>
          <p className="text-sm mb-2">
            {format(new Date(order.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </p>
          <div className="inline-block px-3 py-1 bg-black text-white text-sm font-bold">
            {getStatusLabel(order.status).toUpperCase()}
          </div>
        </div>

        {/* Cliente */}
        <div className="mb-4 text-sm border-b border-dashed border-black pb-4">
          <div className="font-bold mb-2">CLIENTE:</div>
          <div>{customerName}</div>
          <div>Tel: {order.user_phone}</div>
        </div>

        {/* Endereço */}
        <div className="mb-4 text-sm border-b border-dashed border-black pb-4">
          <div className="font-bold mb-2">ENDEREÇO DE ENTREGA:</div>
          <div>{order.delivery_address}</div>
        </div>

        {/* Observações do Pedido */}
        {order.order_notes && (
          <div className="mb-4 text-sm border-2 border-black p-3">
            <div className="font-bold mb-2">⚠️ OBSERVAÇÕES DO PEDIDO:</div>
            <div className="font-bold">{order.order_notes}</div>
          </div>
        )}

        {/* Itens */}
        <div className="mb-4">
          <div className="font-bold text-sm mb-3 border-b-2 border-black pb-2">ITENS DO PEDIDO</div>
          {order.items.map((item, idx) => (
            <div key={idx} className="mb-4 text-sm border-b border-dashed border-black pb-3">
              <div className="flex justify-between font-bold mb-1">
                <span>{item.quantity}x {item.product.name}</span>
                <span>€{calculateItemTotal(item).toFixed(2)}</span>
              </div>
              <div className="text-xs pl-4">
                Unitário: €{item.product.price.toFixed(2)}
              </div>
              {item.addons.length > 0 && (
                <div className="pl-4 mt-1">
                  {item.addons.map((addon) => (
                    <div key={addon.id} className="text-xs">
                      + {addon.name} (€{addon.price.toFixed(2)})
                    </div>
                  ))}
                </div>
              )}
              {item.notes && (
                <div className="pl-4 mt-2 font-bold text-xs border-l-2 border-black pl-2">
                  OBS: {item.notes}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Totais */}
        <div className="text-sm space-y-2 mb-4 border-t-2 border-black pt-4">
          <div className="flex justify-between">
            <span>Subtotal:</span>
            <span>€{subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>Taxa de Entrega:</span>
            <span>€{deliveryFee.toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-bold text-lg border-t-2 border-black pt-2 mt-2">
            <span>TOTAL:</span>
            <span>€{order.total_amount.toFixed(2)}</span>
          </div>
        </div>

        {/* Pagamento */}
        <div className="text-sm mb-6 border-t border-dashed border-black pt-4">
          <div className="flex justify-between font-bold">
            <span>PAGAMENTO:</span>
            <span>{order.payment_method.toUpperCase()}</span>
          </div>
        </div>

        {/* Rodapé */}
        <div className="text-center text-xs border-t-2 border-black pt-4">
          <div className="mb-2">Obrigado pela preferência!</div>
          <div>Este é um comprovante do pedido</div>
        </div>
      </div>
    </div>
  );
}
