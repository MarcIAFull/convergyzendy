-- Corrigir convites pendentes com role inválido
UPDATE team_invitations 
SET role = 'staff' 
WHERE role = 'member' AND status = 'pending';