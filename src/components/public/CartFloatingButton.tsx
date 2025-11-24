import { ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { usePublicCartStore } from '@/stores/publicCartStore';
import { useNavigate } from 'react-router-dom';

interface CartFloatingButtonProps {
  slug: string;
}

export const CartFloatingButton = ({ slug }: CartFloatingButtonProps) => {
  const { getTotalItems, getSubtotal } = usePublicCartStore();
  const navigate = useNavigate();
  const totalItems = getTotalItems();

  if (totalItems === 0) return null;

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: 'EUR',
    }).format(price);
  };

  return (
    <div className="fixed bottom-6 left-0 right-0 flex justify-center px-4 z-50">
      <Button
        onClick={() => navigate(`/menu/${slug}/cart`)}
        size="lg"
        className="bg-orange hover:bg-orange/90 shadow-lg hover:shadow-xl transition-all duration-300 min-w-[280px] h-14"
      >
        <div className="flex items-center gap-3 w-full justify-between">
          <div className="flex items-center gap-2">
            <div className="relative">
              <ShoppingCart className="w-5 h-5" />
              <Badge className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs bg-background text-orange">
                {totalItems}
              </Badge>
            </div>
            <span>Ver Carrinho</span>
          </div>
          <span className="font-bold">{formatPrice(getSubtotal())}</span>
        </div>
      </Button>
    </div>
  );
};
