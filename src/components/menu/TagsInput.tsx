import { useState, KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface TagsInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  label?: string;
  suggestions?: string[];
}

export function TagsInput({ 
  value = [], 
  onChange, 
  placeholder = 'Digite e pressione Enter...', 
  label,
  suggestions = []
}: TagsInputProps) {
  const [inputValue, setInputValue] = useState('');

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag();
    } else if (e.key === 'Backspace' && inputValue === '' && value.length > 0) {
      removeTag(value.length - 1);
    }
  };

  const addTag = () => {
    const trimmed = inputValue.trim().toLowerCase();
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed]);
    }
    setInputValue('');
  };

  const removeTag = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const addSuggestion = (suggestion: string) => {
    if (!value.includes(suggestion.toLowerCase())) {
      onChange([...value, suggestion.toLowerCase()]);
    }
  };

  // Filter suggestions that aren't already added
  const availableSuggestions = suggestions.filter(
    s => !value.includes(s.toLowerCase())
  );

  return (
    <div className="space-y-2">
      {label && <label className="text-sm font-medium">{label}</label>}
      
      <div className="flex flex-wrap gap-1.5 p-2 min-h-[42px] border rounded-md bg-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
        {value.map((tag, index) => (
          <Badge 
            key={index} 
            variant="secondary" 
            className="gap-1 px-2 py-0.5 text-xs"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(index)}
              className="ml-1 rounded-full hover:bg-muted-foreground/20"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={addTag}
          placeholder={value.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[120px] border-0 p-0 h-6 focus-visible:ring-0 focus-visible:ring-offset-0"
        />
      </div>
      
      {availableSuggestions.length > 0 && (
        <div className="flex flex-wrap gap-1">
          <span className="text-xs text-muted-foreground">Sugestões:</span>
          {availableSuggestions.slice(0, 5).map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => addSuggestion(suggestion)}
              className="text-xs text-primary hover:underline"
            >
              +{suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
