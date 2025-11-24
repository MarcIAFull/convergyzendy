-- FASE 1: Database Schema para Multi-Tenant User Management

-- Tabela de convites para equipe
CREATE TABLE public.team_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  permissions JSONB DEFAULT '{"menu": true, "orders": true, "settings": false, "analytics": true}'::jsonb,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  invited_by UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  accepted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX idx_team_invitations_token ON public.team_invitations(token);
CREATE INDEX idx_team_invitations_email ON public.team_invitations(email);
CREATE INDEX idx_team_invitations_restaurant ON public.team_invitations(restaurant_id);
CREATE INDEX idx_team_invitations_status ON public.team_invitations(status);

-- Enable RLS
ALTER TABLE public.team_invitations ENABLE ROW LEVEL SECURITY;

-- RLS Policies para team_invitations
-- Owners podem ver convites do seu restaurante
CREATE POLICY "Owners can view their restaurant invitations"
ON public.team_invitations
FOR SELECT
USING (user_has_restaurant_access(restaurant_id));

-- Owners podem criar convites para seu restaurante
CREATE POLICY "Owners can create invitations"
ON public.team_invitations
FOR INSERT
WITH CHECK (user_has_restaurant_access(restaurant_id));

-- Owners podem deletar convites do seu restaurante
CREATE POLICY "Owners can delete invitations"
ON public.team_invitations
FOR DELETE
USING (user_has_restaurant_access(restaurant_id));

-- Service role pode gerenciar tudo (para edge functions)
CREATE POLICY "Service role can manage all invitations"
ON public.team_invitations
FOR ALL
USING (true)
WITH CHECK (true);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_team_invitations_updated_at
BEFORE UPDATE ON public.team_invitations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Comentários para documentação
COMMENT ON TABLE public.team_invitations IS 'Convites para adicionar membros à equipe de um restaurante';
COMMENT ON COLUMN public.team_invitations.token IS 'Token único para aceitar o convite';
COMMENT ON COLUMN public.team_invitations.permissions IS 'Permissões granulares do membro convidado';