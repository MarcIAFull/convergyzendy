import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tag, X, Loader2, Check, AlertCircle } from 'lucide-react';

export interface AppliedCoupon {
  id: string;
  code: string;
  name: string;
  description?: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  discount_amount: number;
}

interface CouponInputProps {
  restaurantId: string;
  customerPhone: string;
  subtotal: number;
  onCouponApplied: (coupon: AppliedCoupon | null) => void;
  appliedCoupon: AppliedCoupon | null;
}

export function CouponInput({ 
  restaurantId, 
  customerPhone, 
  subtotal, 
  onCouponApplied,
  appliedCoupon 
}: CouponInputProps) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: 'EUR',
    }).format(price);
  };

  const handleApply = async () => {
    if (!code.trim() || !customerPhone) {
      setError('Preencha o telefone antes de aplicar o cupom');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        'https://tgbfqcbqfdzrtbtlycve.supabase.co/functions/v1/validate-coupon',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            restaurant_id: restaurantId,
            coupon_code: code.trim(),
            customer_phone: customerPhone,
            subtotal,
          }),
        }
      );

      const data = await response.json();

      if (data.valid && data.coupon) {
        onCouponApplied(data.coupon);
        setCode('');
      } else {
        setError(data.error || 'Cupom inválido');
      }
    } catch (err) {
      console.error('[CouponInput] Error:', err);
      setError('Erro ao validar cupom');
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = () => {
    onCouponApplied(null);
    setError(null);
  };

  if (appliedCoupon) {
    return (
      <div className="p-4 border border-green-200 bg-green-50 rounded-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-green-100">
              <Check className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-green-800">{appliedCoupon.code}</span>
                <Badge variant="secondary" className="bg-green-200 text-green-800">
                  {appliedCoupon.discount_type === 'percentage' 
                    ? `${appliedCoupon.discount_value}%` 
                    : formatPrice(appliedCoupon.discount_value)}
                </Badge>
              </div>
              <p className="text-sm text-green-700">
                Desconto: {formatPrice(appliedCoupon.discount_amount)}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRemove}
            className="text-green-700 hover:text-green-800 hover:bg-green-100"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Tag className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Código do cupom"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              setError(null);
            }}
            className="pl-10 uppercase"
            disabled={loading}
          />
        </div>
        <Button 
          onClick={handleApply} 
          disabled={loading || !code.trim()}
          variant="secondary"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            'Aplicar'
          )}
        </Button>
      </div>
      
      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
