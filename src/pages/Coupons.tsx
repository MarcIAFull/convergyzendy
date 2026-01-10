import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Tag, 
  Plus, 
  Trash2, 
  Pencil, 
  Copy, 
  Loader2, 
  Percent, 
  Euro,
  Calendar,
  Users
} from 'lucide-react';
import { useRestaurantStore } from '@/stores/restaurantStore';
import { useCouponsStore, Coupon, CreateCouponData } from '@/stores/couponsStore';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';

export default function Coupons() {
  const { restaurant } = useRestaurantStore();
  const { coupons, loading, fetchCoupons, createCoupon, updateCoupon, deleteCoupon, toggleActive } = useCouponsStore();
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<CreateCouponData>({
    code: '',
    name: '',
    description: '',
    discount_type: 'percentage',
    discount_value: 10,
    min_order_value: 0,
    max_discount_amount: undefined,
    usage_limit: undefined,
    usage_limit_per_phone: 1,
    starts_at: new Date().toISOString().slice(0, 16),
    expires_at: undefined,
  });

  useEffect(() => {
    if (restaurant?.id) {
      fetchCoupons(restaurant.id);
    }
  }, [restaurant?.id, fetchCoupons]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: 'EUR',
    }).format(price);
  };

  const generateCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData(prev => ({ ...prev, code }));
  };

  const handleOpenCreate = () => {
    setEditingCoupon(null);
    setFormData({
      code: '',
      name: '',
      description: '',
      discount_type: 'percentage',
      discount_value: 10,
      min_order_value: 0,
      max_discount_amount: undefined,
      usage_limit: undefined,
      usage_limit_per_phone: 1,
      starts_at: new Date().toISOString().slice(0, 16),
      expires_at: undefined,
    });
    setDialogOpen(true);
  };

  const handleOpenEdit = (coupon: Coupon) => {
    setEditingCoupon(coupon);
    setFormData({
      code: coupon.code,
      name: coupon.name,
      description: coupon.description || '',
      discount_type: coupon.discount_type,
      discount_value: coupon.discount_value,
      min_order_value: coupon.min_order_value,
      max_discount_amount: coupon.max_discount_amount || undefined,
      usage_limit: coupon.usage_limit || undefined,
      usage_limit_per_phone: coupon.usage_limit_per_phone,
      starts_at: coupon.starts_at.slice(0, 16),
      expires_at: coupon.expires_at?.slice(0, 16) || undefined,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!restaurant?.id) return;
    if (!formData.code || !formData.name || !formData.discount_value) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }

    setSaving(true);
    try {
      if (editingCoupon) {
        await updateCoupon(editingCoupon.id, formData);
        toast.success('Cupom atualizado!');
      } else {
        await createCoupon(restaurant.id, formData);
        toast.success('Cupom criado!');
      }
      setDialogOpen(false);
    } catch (error) {
      console.error('[Coupons] Save error:', error);
      toast.error('Erro ao salvar cupom');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este cupom?')) return;
    
    try {
      await deleteCoupon(id);
      toast.success('Cupom excluído!');
    } catch (error) {
      toast.error('Erro ao excluir cupom');
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Código copiado!');
  };

  const getCouponStatus = (coupon: Coupon) => {
    if (!coupon.is_active) return { label: 'Inativo', variant: 'secondary' as const };
    
    const now = new Date();
    const start = new Date(coupon.starts_at);
    const end = coupon.expires_at ? new Date(coupon.expires_at) : null;
    
    if (now < start) return { label: 'Agendado', variant: 'outline' as const };
    if (end && now > end) return { label: 'Expirado', variant: 'destructive' as const };
    if (coupon.usage_limit && coupon.current_usage >= coupon.usage_limit) {
      return { label: 'Esgotado', variant: 'destructive' as const };
    }
    
    return { label: 'Ativo', variant: 'default' as const };
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <Tag className="h-8 w-8" />
            Cupons de Desconto
          </h1>
          <p className="text-muted-foreground mt-2">
            Crie e gerencie cupons para seus clientes
          </p>
        </div>
        <Button onClick={handleOpenCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Cupom
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Seus Cupons</CardTitle>
          <CardDescription>
            {coupons.length} cupom(s) cadastrado(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : coupons.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Tag className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum cupom cadastrado</p>
              <Button variant="link" onClick={handleOpenCreate}>
                Criar primeiro cupom
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Desconto</TableHead>
                  <TableHead>Uso</TableHead>
                  <TableHead>Validade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {coupons.map((coupon) => {
                  const status = getCouponStatus(coupon);
                  return (
                    <TableRow key={coupon.id}>
                      <TableCell>
                        <div>
                          <div className="flex items-center gap-2">
                            <code className="font-mono font-bold">{coupon.code}</code>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => handleCopyCode(coupon.code)}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                          <span className="text-sm text-muted-foreground">{coupon.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {coupon.discount_type === 'percentage' ? (
                            <>
                              <Percent className="h-4 w-4 text-muted-foreground" />
                              <span>{coupon.discount_value}%</span>
                            </>
                          ) : (
                            <>
                              <Euro className="h-4 w-4 text-muted-foreground" />
                              <span>{formatPrice(coupon.discount_value)}</span>
                            </>
                          )}
                        </div>
                        {coupon.min_order_value > 0 && (
                          <span className="text-xs text-muted-foreground">
                            Mín: {formatPrice(coupon.min_order_value)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span>
                            {coupon.current_usage}
                            {coupon.usage_limit ? ` / ${coupon.usage_limit}` : ''}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {coupon.expires_at ? (
                            <span>
                              {format(new Date(coupon.expires_at), 'dd/MM/yyyy', { locale: pt })}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">Sem limite</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Switch
                            checked={coupon.is_active}
                            onCheckedChange={() => toggleActive(coupon.id)}
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEdit(coupon)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(coupon.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingCoupon ? 'Editar Cupom' : 'Novo Cupom'}
            </DialogTitle>
            <DialogDescription>
              {editingCoupon ? 'Atualize as informações do cupom' : 'Crie um novo cupom de desconto'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <Label>Código *</Label>
                <Input
                  value={formData.code}
                  onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                  placeholder="DESCONTO10"
                  className="uppercase font-mono"
                />
              </div>
              <div className="flex items-end">
                <Button variant="outline" onClick={generateCode} className="w-full">
                  Gerar
                </Button>
              </div>
            </div>

            <div>
              <Label>Nome *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Desconto de boas-vindas"
              />
            </div>

            <div>
              <Label>Descrição</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Descrição opcional do cupom"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tipo de Desconto *</Label>
                <Select
                  value={formData.discount_type}
                  onValueChange={(v: 'percentage' | 'fixed') => setFormData(prev => ({ ...prev, discount_type: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentual (%)</SelectItem>
                    <SelectItem value="fixed">Valor Fixo (€)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Valor *</Label>
                <Input
                  type="number"
                  min="0"
                  step={formData.discount_type === 'percentage' ? '1' : '0.01'}
                  value={formData.discount_value}
                  onChange={(e) => setFormData(prev => ({ ...prev, discount_value: parseFloat(e.target.value) || 0 }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Pedido Mínimo (€)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.min_order_value || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, min_order_value: parseFloat(e.target.value) || 0 }))}
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label>Desconto Máximo (€)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.max_discount_amount || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, max_discount_amount: parseFloat(e.target.value) || undefined }))}
                  placeholder="Sem limite"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Limite Total de Usos</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.usage_limit || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, usage_limit: parseInt(e.target.value) || undefined }))}
                  placeholder="Ilimitado"
                />
              </div>
              <div>
                <Label>Limite por Telefone</Label>
                <Input
                  type="number"
                  min="1"
                  value={formData.usage_limit_per_phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, usage_limit_per_phone: parseInt(e.target.value) || 1 }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Início</Label>
                <Input
                  type="datetime-local"
                  value={formData.starts_at}
                  onChange={(e) => setFormData(prev => ({ ...prev, starts_at: e.target.value }))}
                />
              </div>
              <div>
                <Label>Expiração</Label>
                <Input
                  type="datetime-local"
                  value={formData.expires_at || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, expires_at: e.target.value || undefined }))}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                editingCoupon ? 'Salvar Alterações' : 'Criar Cupom'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
