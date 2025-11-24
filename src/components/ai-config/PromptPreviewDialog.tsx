import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Loader2, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface PromptPreviewDialogProps {
  prompt: string;
  agentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PromptPreviewDialog({ prompt, agentId, open, onOpenChange }: PromptPreviewDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [processedPrompt, setProcessedPrompt] = useState('');

  useEffect(() => {
    if (open) {
      loadPreview();
    }
  }, [open, prompt]);

  const loadPreview = async () => {
    try {
      setLoading(true);
      
      // Get first restaurant to use as example data
      const { data: restaurants } = await supabase
        .from('restaurants')
        .select('*')
        .limit(1);

      if (!restaurants || restaurants.length === 0) {
        setProcessedPrompt(prompt);
        return;
      }

      const restaurant = restaurants[0];

      // Get some example products
      const { data: products } = await supabase
        .from('products')
        .select('id, name, price, description')
        .eq('restaurant_id', restaurant.id)
        .eq('is_available', true)
        .limit(3);

      // Build example data
      const exampleData = {
        restaurant_name: restaurant.name,
        menu_products: products?.map(p => 
          `• ${p.name} (ID: ${p.id}) - €${p.price}${p.description ? ` - ${p.description}` : ''}`
        ).join('\n') || 'No products available',
        cart_summary: '2x Pizza Margherita (€19.96) | Total: €19.96',
        customer_info: 'Name: João Silva, Address: Rua Augusta 123, Payment: card',
        conversation_history: 'Customer: Olá\nAgent: Olá! Bem-vindo ao ' + restaurant.name,
        current_state: 'browsing_menu',
        user_intent: 'browse_product',
        target_state: 'confirming_item',
        pending_items: 'No pending items'
      };

      // Replace all variables
      let processed = prompt;
      Object.entries(exampleData).forEach(([key, value]) => {
        const regex = new RegExp(`{{${key}}}`, 'g');
        processed = processed.replace(regex, value);
      });

      setProcessedPrompt(processed);
    } catch (error) {
      console.error('Error loading preview:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao carregar preview',
        variant: 'destructive'
      });
      setProcessedPrompt(prompt);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Preview do Prompt Processado</DialogTitle>
          <DialogDescription>
            Visualize como o prompt ficará após substituição das variáveis
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <ScrollArea className="h-[600px] border rounded-lg p-4 bg-muted/30">
            <pre className="whitespace-pre-wrap font-mono text-sm">
              {processedPrompt}
            </pre>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function PromptPreviewButton({ prompt, agentId }: { prompt: string; agentId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-2"
      >
        <Eye className="h-4 w-4" />
        Preview Processado
      </Button>
      <PromptPreviewDialog
        prompt={prompt}
        agentId={agentId}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}