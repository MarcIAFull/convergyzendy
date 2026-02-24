import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2, MapPin, CheckCircle2, XCircle } from 'lucide-react';
import { useGeocoding } from '@/hooks/useGeocoding';
import { cn } from '@/lib/utils';

interface AddressInputProps {
  value: string;
  onChange: (value: string) => void;
  onGeocoded?: (result: { lat: number; lng: number; formatted_address: string }) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  className?: string;
}

export const AddressInput = ({
  value,
  onChange,
  onGeocoded,
  label = 'Endereço de Entrega',
  placeholder = 'Rua, número, bairro, cidade',
  required = false,
  className
}: AddressInputProps) => {
  const [geocodingStatus, setGeocodingStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const { loading, geocodeAddress } = useGeocoding();

  // Debounce address input — wait 2s after user stops typing
  useEffect(() => {
    setGeocodingStatus('idle');
    
    if (!value || value.length < 10) return;

    const timer = setTimeout(() => {
      handleGeocode();
    }, 2000);

    return () => clearTimeout(timer);
  }, [value]);

  const handleGeocode = async () => {
    if (!value || value.length < 10) {
      setGeocodingStatus('idle');
      return;
    }

    setGeocodingStatus('loading');
    
    const result = await geocodeAddress(value);
    
    if (result) {
      setGeocodingStatus('success');
      onGeocoded?.(result);
    } else {
      setGeocodingStatus('error');
    }
  };

  const getStatusIcon = () => {
    switch (geocodingStatus) {
      case 'loading':
        return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return <MapPin className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <div className={cn('space-y-2', className)}>
      <Label htmlFor="address">
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>
      <div className="relative">
        <Input
          id="address"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          className={cn(
            'pr-10',
            geocodingStatus === 'success' && 'border-green-500',
            geocodingStatus === 'error' && 'border-destructive'
          )}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {getStatusIcon()}
        </div>
      </div>
      {geocodingStatus === 'error' && (
        <p className="text-sm text-destructive">
          Endereço não encontrado. Tente adicionar mais detalhes (rua, número, cidade).
        </p>
      )}
      {geocodingStatus === 'success' && (
        <p className="text-sm text-green-600">
          ✓ Endereço validado
        </p>
      )}
    </div>
  );
};
