import { useState, useMemo } from 'react';
import { Product, Addon, AddonGroup } from '@/types/database';
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
import { Badge } from '@/components/ui/badge';
import { Minus, Plus, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ProductModalProps {
  product: Product | null;
  addons: Addon[];
  addonGroups?: AddonGroup[];
  open: boolean;
  onClose: () => void;
  onAddToCart: (product: Product, quantity: number, selectedAddons: Addon[], notes: string) => void;
}

export const ProductModal = ({
  product,
  addons,
  addonGroups = [],
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

  const productAddons = useMemo(() => {
    if (!product) return [];
    return addons.filter((addon) => addon.product_id === product.id);
  }, [addons, product]);

  const productGroups = useMemo(() => {
    if (!product) return [];
    return addonGroups
      .filter((g) => g.product_id === product.id)
      .sort((a, b) => a.sort_order - b.sort_order);
  }, [addonGroups, product]);

  const ungroupedAddons = useMemo(() => {
    return productAddons.filter((a) => !a.group_id);
  }, [productAddons]);

  const hasGroups = productGroups.length > 0;

  // Validation: check if all required groups meet min_selections
  const groupValidation = useMemo(() => {
    const result: Record<string, { selected: number; valid: boolean }> = {};
    for (const group of productGroups) {
      const groupAddonIds = productAddons.filter(a => a.group_id === group.id).map(a => a.id);
      const selected = groupAddonIds.filter(id => selectedAddonIds.has(id)).length;
      const valid = selected >= group.min_selections;
      result[group.id] = { selected, valid };
    }
    return result;
  }, [productGroups, productAddons, selectedAddonIds]);

  const allGroupsValid = productGroups.every(g => groupValidation[g.id]?.valid);

  const toggleAddon = (addonId: string, groupId: string | null) => {
    const newSet = new Set(selectedAddonIds);
    if (newSet.has(addonId)) {
      newSet.delete(addonId);
    } else {
      // Check max_selections for the group
      if (groupId) {
        const group = productGroups.find(g => g.id === groupId);
        if (group?.max_selections != null) {
          const groupAddonIds = productAddons.filter(a => a.group_id === groupId).map(a => a.id);
          const currentSelected = groupAddonIds.filter(id => newSet.has(id)).length;
          if (currentSelected >= group.max_selections) {
            toast({ title: `Máximo de ${group.max_selections} seleções nesta etapa`, variant: 'destructive' });
            return;
          }
        }
      }
      newSet.add(addonId);
    }
    setSelectedAddonIds(newSet);
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(price);
  };

  // Calculate total considering group-level free_selections
  const calculateTotalPrice = () => {
    if (!product) return 0;
    let addonsTotal = 0;

    if (hasGroups) {
      // Per-group free_selections
      for (const group of productGroups) {
        const groupAddonList = productAddons
          .filter(a => a.group_id === group.id)
          .filter(a => selectedAddonIds.has(a.id));
        const paidAddons = groupAddonList.slice(group.free_selections);
        addonsTotal += paidAddons.reduce((sum, a) => sum + a.price, 0);
      }
      // Ungrouped addons use product-level free_addons_count
      const ungroupedSelected = ungroupedAddons.filter(a => selectedAddonIds.has(a.id));
      const freeCount = product.free_addons_count ?? 0;
      const paidUngrouped = ungroupedSelected.slice(freeCount);
      addonsTotal += paidUngrouped.reduce((sum, a) => sum + a.price, 0);
    } else {
      // Legacy: flat addons with product-level free_addons_count
      const selected = productAddons.filter(a => selectedAddonIds.has(a.id));
      const freeCount = product.free_addons_count ?? 0;
      const paid = selected.slice(freeCount);
      addonsTotal = paid.reduce((sum, a) => sum + a.price, 0);
    }

    return (product.price + addonsTotal) * quantity;
  };

  const handleAddToCart = () => {
    if (!product) return;
    if (!allGroupsValid) {
      toast({ title: 'Preencha todas as etapas obrigatórias', variant: 'destructive' });
      return;
    }
    const selectedAddons = productAddons.filter((addon) => selectedAddonIds.has(addon.id));
    onAddToCart(product, quantity, selectedAddons, notes);
    toast({ title: 'Adicionado ao carrinho', description: `${quantity}x ${product.name}` });
    handleClose();
  };

  if (!product) return null;

  const renderAddonItem = (addon: Addon, isFree: boolean) => (
    <div key={addon.id} className="flex items-center space-x-2">
      <Checkbox
        id={addon.id}
        checked={selectedAddonIds.has(addon.id)}
        onCheckedChange={() => toggleAddon(addon.id, addon.group_id)}
      />
      <label htmlFor={addon.id} className="flex-1 cursor-pointer flex items-center justify-between">
        <span className="text-foreground">{addon.name}</span>
        <span className="text-muted-foreground">
          {isFree ? 'Grátis' : `+ ${formatPrice(addon.price)}`}
        </span>
      </label>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">{product.name}</DialogTitle>
          <Button variant="ghost" size="icon" className="absolute right-4 top-4" onClick={handleClose}>
            <X className="w-4 h-4" />
          </Button>
        </DialogHeader>

        <div className="space-y-6">
          {product.image_url && (
            <img src={product.image_url} alt={product.name} className="w-full h-64 object-cover rounded-lg" />
          )}

          {product.description && (
            <p className="text-muted-foreground">{product.description}</p>
          )}

          <div className="text-2xl font-bold text-primary">
            {formatPrice(product.price)}
          </div>

          {/* Grouped addons (steps) */}
          {productGroups.map((group) => {
            const groupAddons = productAddons.filter(a => a.group_id === group.id);
            if (groupAddons.length === 0) return null;
            const validation = groupValidation[group.id];
            const selectedInGroup = groupAddons.filter(a => selectedAddonIds.has(a.id));

            return (
              <div key={group.id} className="space-y-3 border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <Label className="text-lg font-semibold">{group.name}</Label>
                  <div className="flex items-center gap-2">
                    {group.min_selections > 0 && (
                      <Badge variant={validation?.valid ? 'secondary' : 'destructive'} className="text-xs">
                        {group.min_selections > 0 ? `Mín: ${group.min_selections}` : ''}
                      </Badge>
                    )}
                    {group.max_selections != null && (
                      <Badge variant="outline" className="text-xs">
                        Máx: {group.max_selections}
                      </Badge>
                    )}
                  </div>
                </div>
                {group.free_selections > 0 && (
                  <p className="text-sm text-muted-foreground">
                    {group.free_selections} {group.free_selections === 1 ? 'seleção grátis' : 'seleções grátis'}
                    {validation && validation.selected > 0 && validation.selected <= group.free_selections && (
                      <> — {group.free_selections - validation.selected} restante(s)</>
                    )}
                  </p>
                )}
                <div className="space-y-2">
                  {groupAddons.map((addon, idx) => {
                    const isFree = selectedInGroup.indexOf(addon) >= 0 && selectedInGroup.indexOf(addon) < group.free_selections;
                    return renderAddonItem(addon, isFree);
                  })}
                </div>
              </div>
            );
          })}

          {/* Ungrouped addons (legacy / flat) */}
          {ungroupedAddons.length > 0 && (
            <div className="space-y-3">
              <Label className="text-lg font-semibold">
                {hasGroups ? 'Adicionais Extra' : 'Adicionais'}
              </Label>
              {!hasGroups && (product.free_addons_count ?? 0) > 0 && (
                <p className="text-sm text-muted-foreground">
                  Escolha até {product.free_addons_count} adicionais grátis
                  {(() => {
                    const ungroupedSelected = ungroupedAddons.filter(a => selectedAddonIds.has(a.id));
                    const remaining = (product.free_addons_count ?? 0) - ungroupedSelected.length;
                    return remaining > 0 && ungroupedSelected.length > 0 ? ` — ${remaining} restante(s)` : '';
                  })()}
                </p>
              )}
              <div className="space-y-2">
                {ungroupedAddons.map((addon, idx) => {
                  const freeCount = hasGroups ? 0 : (product.free_addons_count ?? 0);
                  const ungroupedSelected = ungroupedAddons.filter(a => selectedAddonIds.has(a.id));
                  const addonIndex = ungroupedSelected.indexOf(addon);
                  const isFree = addonIndex >= 0 && addonIndex < freeCount;
                  return renderAddonItem(addon, isFree);
                })}
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
              <Button variant="outline" size="icon" onClick={() => setQuantity(Math.max(1, quantity - 1))}>
                <Minus className="w-4 h-4" />
              </Button>
              <span className="text-xl font-bold w-8 text-center">{quantity}</span>
              <Button variant="outline" size="icon" onClick={() => setQuantity(quantity + 1)}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button 
            onClick={handleAddToCart} 
            className="w-full bg-orange hover:bg-orange/90" 
            size="lg"
            disabled={!allGroupsValid}
          >
            Adicionar ao carrinho · {formatPrice(calculateTotalPrice())}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
