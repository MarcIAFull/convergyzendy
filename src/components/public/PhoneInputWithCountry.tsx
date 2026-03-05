import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ChevronDown } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Country {
  code: string;
  name: string;
  dial: string;
  flag: string;
}

const countries: Country[] = [
  { code: 'PT', name: 'Portugal', dial: '+351', flag: '🇵🇹' },
  { code: 'BR', name: 'Brasil', dial: '+55', flag: '🇧🇷' },
  { code: 'ES', name: 'Espanha', dial: '+34', flag: '🇪🇸' },
  { code: 'FR', name: 'França', dial: '+33', flag: '🇫🇷' },
  { code: 'DE', name: 'Alemanha', dial: '+49', flag: '🇩🇪' },
  { code: 'IT', name: 'Itália', dial: '+39', flag: '🇮🇹' },
  { code: 'GB', name: 'Reino Unido', dial: '+44', flag: '🇬🇧' },
  { code: 'US', name: 'Estados Unidos', dial: '+1', flag: '🇺🇸' },
  { code: 'AO', name: 'Angola', dial: '+244', flag: '🇦🇴' },
  { code: 'MZ', name: 'Moçambique', dial: '+258', flag: '🇲🇿' },
  { code: 'CV', name: 'Cabo Verde', dial: '+238', flag: '🇨🇻' },
  { code: 'GW', name: 'Guiné-Bissau', dial: '+245', flag: '🇬🇼' },
  { code: 'ST', name: 'São Tomé e Príncipe', dial: '+239', flag: '🇸🇹' },
  { code: 'TL', name: 'Timor-Leste', dial: '+670', flag: '🇹🇱' },
  { code: 'CH', name: 'Suíça', dial: '+41', flag: '🇨🇭' },
  { code: 'LU', name: 'Luxemburgo', dial: '+352', flag: '🇱🇺' },
  { code: 'BE', name: 'Bélgica', dial: '+32', flag: '🇧🇪' },
  { code: 'NL', name: 'Países Baixos', dial: '+31', flag: '🇳🇱' },
  { code: 'AT', name: 'Áustria', dial: '+43', flag: '🇦🇹' },
  { code: 'IE', name: 'Irlanda', dial: '+353', flag: '🇮🇪' },
  { code: 'SE', name: 'Suécia', dial: '+46', flag: '🇸🇪' },
  { code: 'NO', name: 'Noruega', dial: '+47', flag: '🇳🇴' },
  { code: 'DK', name: 'Dinamarca', dial: '+45', flag: '🇩🇰' },
  { code: 'PL', name: 'Polónia', dial: '+48', flag: '🇵🇱' },
  { code: 'GR', name: 'Grécia', dial: '+30', flag: '🇬🇷' },
];

interface PhoneInputWithCountryProps {
  value: string;
  onChange: (fullPhone: string) => void;
  required?: boolean;
  id?: string;
}

export function PhoneInputWithCountry({ value, onChange, required, id }: PhoneInputWithCountryProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<Country>(countries[0]); // Portugal default
  const [localNumber, setLocalNumber] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  // Parse initial value if it starts with a known dial code
  useEffect(() => {
    if (value && !localNumber) {
      for (const country of countries) {
        if (value.startsWith(country.dial)) {
          setSelectedCountry(country);
          setLocalNumber(value.slice(country.dial.length).trim());
          return;
        }
      }
      // If no match, just set as local number
      setLocalNumber(value.replace(/^\+\d+\s*/, ''));
    }
  }, []);

  const handleNumberChange = (num: string) => {
    // Only allow digits and spaces
    const cleaned = num.replace(/[^\d\s]/g, '');
    setLocalNumber(cleaned);
    onChange(`${selectedCountry.dial}${cleaned.replace(/\s/g, '')}`);
  };

  const handleCountrySelect = (country: Country) => {
    setSelectedCountry(country);
    setOpen(false);
    setSearch('');
    onChange(`${country.dial}${localNumber.replace(/\s/g, '')}`);
  };

  const filteredCountries = countries.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.dial.includes(search) ||
    c.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex gap-0">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="rounded-r-none border-r-0 px-3 h-10 min-w-[100px] justify-between gap-1 font-normal"
          >
            <span className="text-lg leading-none">{selectedCountry.flag}</span>
            <span className="text-sm text-muted-foreground">{selectedCountry.dial}</span>
            <ChevronDown className="h-3 w-3 opacity-50 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0" align="start">
          <div className="p-2 border-b border-border">
            <Input
              ref={searchRef}
              placeholder="Pesquisar país..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          <ScrollArea className="h-[250px]">
            <div className="p-1">
              {filteredCountries.map((country) => (
                <button
                  key={country.code}
                  type="button"
                  onClick={() => handleCountrySelect(country)}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground transition-colors ${
                    selectedCountry.code === country.code ? 'bg-accent text-accent-foreground' : ''
                  }`}
                >
                  <span className="text-lg leading-none">{country.flag}</span>
                  <span className="flex-1 text-left truncate">{country.name}</span>
                  <span className="text-muted-foreground text-xs">{country.dial}</span>
                </button>
              ))}
              {filteredCountries.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum país encontrado</p>
              )}
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>
      <Input
        id={id}
        type="tel"
        required={required}
        value={localNumber}
        onChange={(e) => handleNumberChange(e.target.value)}
        placeholder="900 000 000"
        className="rounded-l-none flex-1"
      />
    </div>
  );
}
