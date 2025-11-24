import { useState } from 'react';
import { Product, Addon } from '@/types/database';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Minus, Plus, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ProductModalProps {
  product: Product | null;
  addons: Addon[];
  open: boolean;
  onClose: () => void;
  onAddToCart: (product: Product, quantity: number, selectedAddons: Addon[], notes: string) => void;
}

export const ProductModal = ({
  product,
  addons,
  open,
  onClose,
  onAddToCart,
}: ProductModalProps) => {
  const [quantity, setQuantity] = useState(1);
  const [selectedAddonIds, setSelectedAddonIds] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState('');
  const { toast } = useToast();

  const handleClose = () => {
    setQuantity(1);
    setSelectedAddonIds(new Set());
    setNotes('');
    onClose();
  };

  const handleAddToCart = () => {
    if (!product) return;

    const selectedAddons = addons.filter((addon) => selectedAddonIds.has(addon.id));
    onAddToCart(product, quantity, selectedAddons, notes);

    toast({
      title: 'Adicionado ao carrinho',
      description: `${quantity}x ${product.name}`,
    });

    handleClose();
  };

  const toggleAddon = (addonId: string) => {
    const newSet = new Set(selectedAddonIds);
    if (newSet.has(addonId)) {
      newSet.delete(addonId);
    } else {
      newSet.add(addonId);
    }
    setSelectedAddonIds(newSet);
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: 'EUR',
    }).format(price);
  };

  const calculateTotalPrice = () => {
    if (!product) return 0;
    const addonsTotal = addons
      .filter((addon) => selectedAddonIds.has(addon.id))
      .reduce((sum, addon) => sum + addon.price, 0);
    return (product.price + addonsTotal) * quantity;
  };

  if (!product) return null;

  const productAddons = addons.filter((addon) => addon.product_id === product.id);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">{product.name}</DialogTitle>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 top-4"
            onClick={handleClose}
          >
            <X className="w-4 h-4" />
          </Button>
        </DialogHeader>

        <div className="space-y-6">
          {/* Imagem */}
          {product.image_url && (
            <img
              src={product.image_url}
              alt={product.name}
              className="w-full h-64 object-cover rounded-lg"
            />
          )}

          {/* Descrição */}
          {product.description && (
            <p className="text-muted-foreground">{product.description}</p>
          )}

          {/* Preço base */}
          <div className="text-2xl font-bold text-primary">
            {formatPrice(product.price)}
          </div>

          {/* Addons */}
          {productAddons.length > 0 && (
            <div className="space-y-3">
              <Label className="text-lg font-semibold">Adicionais</Label>
              <div className="space-y-2">
                {productAddons.map((addon) => (
                  <div key={addon.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={addon.id}
                      checked={selectedAddonIds.has(addon.id)}
                      onCheckedChange={() => toggleAddon(addon.id)}
                    />
                    <label
                      htmlFor={addon.id}
                      className="flex-1 cursor-pointer flex items-center justify-between"
                    >
                      <span className="text-foreground">{addon.name}</span>
                      <span className="text-muted-foreground">
                        + {formatPrice(addon.price)}
                      </span>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Observações */}
          <div className="space-y-2">
            <Label htmlFor="notes">Observações (opcional)</Label>
            <Textarea
              id="notes"
              placeholder="Ex: Sem cebola, bem passado..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          {/* Quantidade */}
          <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
            <span className="font-semibold">Quantidade</span>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
              >
                <Minus className="w-4 h-4" />
              </Button>
              <span className="text-xl font-bold w-8 text-center">{quantity}</span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setQuantity(quantity + 1)}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handleAddToCart} className="w-full bg-orange hover:bg-orange/90" size="lg">
            Adicionar ao carrinho · {formatPrice(calculateTotalPrice())}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
