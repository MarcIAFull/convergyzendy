export interface RestaurantAISettings {
  id: string;
  restaurant_id: string;
  tone: 'friendly' | 'formal' | 'playful' | 'professional';
  greeting_message: string | null;
  closing_message: string | null;
  upsell_aggressiveness: 'low' | 'medium' | 'high';
  max_additional_questions_before_checkout: number;
  language: string;
  created_at: string;
  updated_at: string;
}

export interface RestaurantPromptOverride {
  id: string;
  restaurant_id: string;
  block_key: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export const TONE_OPTIONS = [
  { value: 'friendly', label: 'Amigável' },
  { value: 'formal', label: 'Formal' },
  { value: 'playful', label: 'Descontraído' },
  { value: 'professional', label: 'Profissional' }
] as const;

export const UPSELL_OPTIONS = [
  { value: 'low', label: 'Baixo', description: 'Raramente sugere itens adicionais' },
  { value: 'medium', label: 'Médio', description: 'Sugere itens relevantes ocasionalmente' },
  { value: 'high', label: 'Alto', description: 'Ativamente sugere complementos e upgrades' }
] as const;
