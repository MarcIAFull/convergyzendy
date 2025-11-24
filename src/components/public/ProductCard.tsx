import { Product } from '@/types/database';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ProductCardProps {
  product: Product;
  onClick: () => void;
  accentColor?: string;
}

export const ProductCard = ({ product, onClick, accentColor }: ProductCardProps) => {
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: 'EUR',
    }).format(price);
  };

  const buttonStyle = accentColor ? {
    backgroundColor: accentColor,
    color: '#ffffff'
  } : undefined;

  return (
    <Card
      className="overflow-hidden cursor-pointer hover:shadow-lg transition-all duration-300 group"
      onClick={onClick}
    >
      <div className="relative">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-48 bg-muted flex items-center justify-center">
            <span className="text-4xl">🍽️</span>
          </div>
        )}
        
        {(product as any).is_featured && (
          <Badge 
            className="absolute top-2 right-2"
            style={accentColor ? { 
              backgroundColor: accentColor,
              color: '#ffffff'
            } : undefined}
          >
            Destaque
          </Badge>
        )}
      </div>

      <div className="p-4">
        <h3 className="font-semibold text-lg text-foreground mb-1 line-clamp-1">
          {product.name}
        </h3>
        
        {product.description && (
          <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
            {product.description}
          </p>
        )}

        <div className="flex items-center justify-between">
          <span className="text-xl font-bold text-primary">
            {formatPrice(product.price)}
          </span>

          <Button 
            size="sm" 
            className={accentColor ? '' : 'bg-orange hover:bg-orange/90'}
            style={buttonStyle}
          >
            <Plus className="w-4 h-4 mr-1" />
            Adicionar
          </Button>
        </div>
      </div>
    </Card>
  );
};