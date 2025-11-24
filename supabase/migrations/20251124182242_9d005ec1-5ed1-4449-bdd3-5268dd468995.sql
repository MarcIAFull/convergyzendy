-- Criar tabela de fila de debounce de mensagens
CREATE TABLE IF NOT EXISTS public.message_debounce_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  customer_phone text NOT NULL,
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  first_message_at timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz NOT NULL DEFAULT now(),
  scheduled_process_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  processed_at timestamptz,
  error_message text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_message_debounce_queue_status 
  ON public.message_debounce_queue(status);

CREATE INDEX IF NOT EXISTS idx_message_debounce_queue_scheduled 
  ON public.message_debounce_queue(scheduled_process_at) 
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_message_debounce_queue_restaurant_customer 
  ON public.message_debounce_queue(restaurant_id, customer_phone, status);

-- RLS Policies
ALTER TABLE public.message_debounce_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage message debounce queue"
  ON public.message_debounce_queue
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can view their restaurant debounce queue"
  ON public.message_debounce_queue
  FOR SELECT
  USING (user_has_restaurant_access(restaurant_id));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_message_debounce_queue_updated_at
  BEFORE UPDATE ON public.message_debounce_queue
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Comentários para documentação
COMMENT ON TABLE public.message_debounce_queue IS 'Fila de debounce para agrupar mensagens rápidas do mesmo cliente';
COMMENT ON COLUMN public.message_debounce_queue.messages IS 'Array de objetos com {body, timestamp} das mensagens acumuladas';
COMMENT ON COLUMN public.message_debounce_queue.scheduled_process_at IS 'Timestamp para processar (last_message_at + 5 segundos)';
COMMENT ON COLUMN public.message_debounce_queue.status IS 'Status: pending (aguardando), processing (processando), completed (concluído), failed (erro)';