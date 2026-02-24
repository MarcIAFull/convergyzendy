import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, MapPin, CheckCircle2, XCircle } from 'lucide-react';
import { useGeocoding } from '@/hooks/useGeocoding';
import { cn } from '@/lib/utils';

interface GeocodingResult {
  lat: number;
  lng: number;
  formatted_address: string;
  place_id?: string;
  address_components?: any;
  source?: string;
}

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
  const [status, setStatus] = useState<'idle' | 'loading' | 'suggestions' | 'selected' | 'error'>('idle');
  const [suggestions, setSuggestions] = useState<GeocodingResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const { geocodeAddressMulti } = useGeocoding();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounce: wait 2s after user stops typing, then fetch suggestions
  useEffect(() => {
    // Reset when typing
    if (status === 'selected') return; // don't re-search after selecting
    
    setStatus('idle');
    setSuggestions([]);
    setShowDropdown(false);

    if (!value || value.length < 10) return;

    timerRef.current = setTimeout(async () => {
      setStatus('loading');
      const results = await geocodeAddressMulti(value);
      
      if (results.length > 0) {
        setSuggestions(results);
        setShowDropdown(true);
        setStatus('suggestions');
      } else {
        setStatus('error');
      }
    }, 2000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [value]);

  const handleInputChange = (newValue: string) => {
    // When user types, reset the selected state so debounce works again
    if (status === 'selected') {
      setStatus('idle');
    }
    onChange(newValue);
  };

  const handleSelect = (result: GeocodingResult) => {
    onChange(result.formatted_address);
    setStatus('selected');
    setSuggestions([]);
    setShowDropdown(false);
    onGeocoded?.({
      lat: result.lat,
      lng: result.lng,
      formatted_address: result.formatted_address
    });
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'loading':
        return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
      case 'selected':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return <MapPin className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <div ref={wrapperRef} className={cn('space-y-2 relative', className)}>
      <Label htmlFor="address">
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>
      <div className="relative">
        <Input
          id="address"
          value={value}
          onChange={(e) => handleInputChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          autoComplete="off"
          className={cn(
            'pr-10',
            status === 'selected' && 'border-green-500',
            status === 'error' && 'border-destructive'
          )}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {getStatusIcon()}
        </div>
      </div>

      {/* Suggestions dropdown */}
      {showDropdown && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 z-50 mt-1 rounded-md border bg-popover text-popover-foreground shadow-md max-h-60 overflow-y-auto">
          <div className="p-1">
            <p className="px-3 py-1.5 text-xs font-medium text-muted-foreground">
              Selecione o endereço correto:
            </p>
            {suggestions.map((s, i) => (
              <button
                key={`${s.place_id || i}-${s.lat}`}
                type="button"
                onClick={() => handleSelect(s)}
                className="flex items-start gap-2 w-full rounded-sm px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer"
              >
                <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                <span className="line-clamp-2">{s.formatted_address}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {status === 'error' && (
        <p className="text-sm text-destructive">
          Endereço não encontrado. Tente adicionar mais detalhes (rua, número, cidade).
        </p>
      )}
      {status === 'selected' && (
        <p className="text-sm text-green-600">
          ✓ Endereço validado
        </p>
      )}
    </div>
  );
};
