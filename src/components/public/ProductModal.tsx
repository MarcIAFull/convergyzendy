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
  // Map<addonId, quantity> — allows selecting same addon multiple times
  const [addonQuantities, setAddonQuantities] = useState<Map<string, number>>(new Map());
  const [notes, setNotes] = useState('');
  const { toast } = useToast();

  const handleClose = () => {
    setQuantity(1);
    setAddonQuantities(new Map());
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

  // Get total selected count for a group
  const getGroupSelectedCount = (groupId: string) => {
    const groupAddonIds = productAddons.filter(a => a.group_id === groupId).map(a => a.id);
    return groupAddonIds.reduce((sum, id) => sum + (addonQuantities.get(id) || 0), 0);
  };

  // Get total selected count for ungrouped addons
  const getUngroupedSelectedCount = () => {
    return ungroupedAddons.reduce((sum, a) => sum + (addonQuantities.get(a.id) || 0), 0);
  };

  // Get total addon count across all groups and ungrouped
  const getTotalAddonCount = () => {
    return Array.from(addonQuantities.values()).reduce((sum, q) => sum + q, 0);
  };

  // Validation: check if all required groups meet min_selections
  const groupValidation = useMemo(() => {
    const result: Record<string, { selected: number; valid: boolean }> = {};
    for (const group of productGroups) {
      const selected = getGroupSelectedCount(group.id);
      const valid = selected >= group.min_selections;
      result[group.id] = { selected, valid };
    }
    return result;
  }, [productGroups, productAddons, addonQuantities]);

  const allGroupsValid = productGroups.every(g => groupValidation[g.id]?.valid);

  const incrementAddon = (addonId: string, groupId: string | null) => {
    // Check max_selections for the group
    if (groupId) {
      const group = productGroups.find(g => g.id === groupId);
      if (group?.max_selections != null) {
        const currentSelected = getGroupSelectedCount(groupId);
        if (currentSelected >= group.max_selections) {
          toast({ title: `Máximo de ${group.max_selections} seleções nesta etapa`, variant: 'destructive' });
          return;
        }
      }
    }

    // Check product-level max_addons
    if (product?.max_addons != null) {
      const totalCount = getTotalAddonCount();
      if (totalCount >= product.max_addons) {
        toast({ title: `Máximo de ${product.max_addons} adicionais por item`, variant: 'destructive' });
        return;
      }
    }

    const newMap = new Map(addonQuantities);
    newMap.set(addonId, (newMap.get(addonId) || 0) + 1);
    setAddonQuantities(newMap);
  };

  const decrementAddon = (addonId: string) => {
    const current = addonQuantities.get(addonId) || 0;
    if (current <= 0) return;
    const newMap = new Map(addonQuantities);
    if (current === 1) {
      newMap.delete(addonId);
    } else {
      newMap.set(addonId, current - 1);
    }
    setAddonQuantities(newMap);
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(price);
  };

  // Build flat addon array from quantities (with duplicates for repeated selections)
  const buildSelectedAddonsArray = (): Addon[] => {
    const result: Addon[] = [];
    for (const addon of productAddons) {
      const qty = addonQuantities.get(addon.id) || 0;
      for (let i = 0; i < qty; i++) {
        result.push(addon);
      }
    }
    return result;
  };

  // Calculate total considering group-level free_selections
  const calculateTotalPrice = () => {
    if (!product) return 0;
    let addonsTotal = 0;

    if (hasGroups) {
      // Per-group free_selections
      for (const group of productGroups) {
        const groupAddonList = productAddons.filter(a => a.group_id === group.id);
        // Build expanded list respecting quantities
        const expandedGroupAddons: Addon[] = [];
        for (const addon of groupAddonList) {
          const qty = addonQuantities.get(addon.id) || 0;
          for (let i = 0; i < qty; i++) {
            expandedGroupAddons.push(addon);
          }
        }
        const paidAddons = expandedGroupAddons.slice(group.free_selections);
        addonsTotal += paidAddons.reduce((sum, a) => sum + a.price, 0);
      }
      // Ungrouped addons use product-level free_addons_count
      const expandedUngrouped: Addon[] = [];
      for (const addon of ungroupedAddons) {
        const qty = addonQuantities.get(addon.id) || 0;
        for (let i = 0; i < qty; i++) {
          expandedUngrouped.push(addon);
        }
      }
      const freeCount = product.free_addons_count ?? 0;
      const paidUngrouped = expandedUngrouped.slice(freeCount);
      addonsTotal += paidUngrouped.reduce((sum, a) => sum + a.price, 0);
    } else {
      // Legacy: flat addons with product-level free_addons_count
      const expandedAll = buildSelectedAddonsArray();
      const freeCount = product.free_addons_count ?? 0;
      const paid = expandedAll.slice(freeCount);
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
    const selectedAddons = buildSelectedAddonsArray();
    onAddToCart(product, quantity, selectedAddons, notes);
    toast({ title: 'Adicionado ao carrinho', description: `${quantity}x ${product.name}` });
    handleClose();
  };

  if (!product) return null;

  const renderAddonItem = (addon: Addon, groupId: string | null, isFreeLabel: boolean) => {
    const qty = addonQuantities.get(addon.id) || 0;
    return (
      <div key={addon.id} className="flex items-center justify-between py-1.5">
        <span className="text-foreground text-sm">{addon.name}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground min-w-[50px] text-right">
            {isFreeLabel && qty > 0 ? 'Grátis' : addon.price > 0 ? `+ ${formatPrice(addon.price)}` : 'Grátis'}
          </span>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => decrementAddon(addon.id)}
              disabled={qty === 0}
            >
              <Minus className="w-3 h-3" />
            </Button>
            <span className="text-sm font-medium w-6 text-center">{qty}</span>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => incrementAddon(addon.id, groupId)}
            >
              <Plus className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </div>
    );
  };

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
            const selectedCount = getGroupSelectedCount(group.id);

            // Track how many free slots remain
            let freeRemaining = group.free_selections;

            return (
              <div key={group.id} className="space-y-3 border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <Label className="text-lg font-semibold">{group.name}</Label>
                  <div className="flex items-center gap-2">
                    {group.min_selections > 0 && (
                      <Badge variant={validation?.valid ? 'secondary' : 'destructive'} className="text-xs">
                        Mín: {group.min_selections}
                      </Badge>
                    )}
                    {group.max_selections != null && (
                      <Badge variant="outline" className="text-xs">
                        {selectedCount}/{group.max_selections}
                      </Badge>
                    )}
                  </div>
                </div>
                {group.free_selections > 0 && (
                  <p className="text-sm text-muted-foreground">
                    {group.free_selections} {group.free_selections === 1 ? 'seleção grátis' : 'seleções grátis'}
                    {selectedCount > 0 && selectedCount <= group.free_selections && (
                      <> — {group.free_selections - selectedCount} restante(s)</>
                    )}
                  </p>
                )}
                <div className="space-y-1">
                  {groupAddons.map((addon) => {
                    const qty = addonQuantities.get(addon.id) || 0;
                    // Determine if this addon's units fall within free slots
                    const isFree = freeRemaining > 0 && qty > 0;
                    freeRemaining = Math.max(0, freeRemaining - qty);
                    return renderAddonItem(addon, group.id, isFree);
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
                    const totalSelected = getUngroupedSelectedCount();
                    const remaining = (product.free_addons_count ?? 0) - totalSelected;
                    return remaining > 0 && totalSelected > 0 ? ` — ${remaining} restante(s)` : '';
                  })()}
                </p>
              )}
              <div className="space-y-1">
                {(() => {
                  const freeCount = hasGroups ? 0 : (product.free_addons_count ?? 0);
                  let freeRemaining = freeCount;
                  return ungroupedAddons.map((addon) => {
                    const qty = addonQuantities.get(addon.id) || 0;
                    const isFree = freeRemaining > 0 && qty > 0;
                    freeRemaining = Math.max(0, freeRemaining - qty);
                    return renderAddonItem(addon, null, isFree);
                  });
                })()}
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
