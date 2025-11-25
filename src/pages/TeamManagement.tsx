import { useState, useEffect } from 'react';
import { useRestaurantStore } from '@/stores/restaurantStore';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Trash2, Mail, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { InviteMemberDialog } from '@/components/team/InviteMemberDialog';

interface TeamMember {
  id: string;
  user_id: string;
  role: string;
  permissions: any;
  created_at: string;
  user_email?: string;
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
  expires_at: string;
}

export default function TeamManagement() {
  const { restaurant } = useRestaurantStore();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [memberToDelete, setMemberToDelete] = useState<string | null>(null);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);

  useEffect(() => {
    if (restaurant?.id) {
      fetchTeamData();
    }
  }, [restaurant?.id]);

  const fetchTeamData = async () => {
    if (!restaurant?.id) return;

    try {
      setLoading(true);

      // Fetch team members with emails using RPC function
      const { data: membersData, error: membersError } = await supabase
        .rpc('get_team_members_with_email', { 
          p_restaurant_id: restaurant.id 
        });

      if (membersError) throw membersError;

      setMembers(membersData || []);

      // Fetch pending invitations
      const { data: invitationsData, error: invitationsError } = await supabase
        .from('team_invitations')
        .select('*')
        .eq('restaurant_id', restaurant.id)
        .eq('status', 'pending');

      if (invitationsError) throw invitationsError;

      setInvitations(invitationsData || []);

    } catch (error) {
      console.error('Error fetching team data:', error);
      toast.error('Erro ao carregar equipe');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMember = async (memberId: string) => {
    try {
      const { error } = await supabase
        .from('restaurant_owners')
        .delete()
        .eq('id', memberId);

      if (error) throw error;

      toast.success('Membro removido com sucesso');
      fetchTeamData();
    } catch (error) {
      console.error('Error deleting member:', error);
      toast.error('Erro ao remover membro');
    } finally {
      setMemberToDelete(null);
    }
  };

  const handleDeleteInvitation = async (invitationId: string) => {
    try {
      const { error } = await supabase
        .from('team_invitations')
        .delete()
        .eq('id', invitationId);

      if (error) throw error;

      toast.success('Convite cancelado');
      fetchTeamData();
    } catch (error) {
      console.error('Error deleting invitation:', error);
      toast.error('Erro ao cancelar convite');
    }
  };

  const getRoleBadge = (role: string) => {
    const variants: Record<string, "default" | "secondary" | "outline"> = {
      owner: 'default',
      admin: 'secondary',
      member: 'outline'
    };
    return <Badge variant={variants[role] || 'outline'}>{role}</Badge>;
  };

  if (!restaurant) {
    return (
      <div className="container mx-auto py-8">
        <p className="text-muted-foreground">Selecione um restaurante primeiro</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Gestão de Equipe</h1>
          <p className="text-muted-foreground">
            Gerencie membros e convites para {restaurant.name}
          </p>
        </div>
        <Button onClick={() => setInviteDialogOpen(true)}>
          <UserPlus className="mr-2 h-4 w-4" />
          Convidar Membro
        </Button>
      </div>

      {/* Team Members */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Membros Ativos</h2>
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead>Adicionado em</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : members.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    Nenhum membro encontrado
                  </TableCell>
                </TableRow>
              ) : (
                members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">{member.user_email}</TableCell>
                    <TableCell>{getRoleBadge(member.role)}</TableCell>
                    <TableCell>
                      {new Date(member.created_at).toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell className="text-right">
                      {member.role !== 'owner' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setMemberToDelete(member.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pending Invitations */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Convites Pendentes</h2>
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead>Expira em</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invitations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    Nenhum convite pendente
                  </TableCell>
                </TableRow>
              ) : (
                invitations.map((invitation) => (
                  <TableRow key={invitation.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        {invitation.email}
                      </div>
                    </TableCell>
                    <TableCell>{getRoleBadge(invitation.role)}</TableCell>
                    <TableCell>
                      {new Date(invitation.expires_at).toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteInvitation(invitation.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!memberToDelete} onOpenChange={() => setMemberToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Membro</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover este membro? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => memberToDelete && handleDeleteMember(memberToDelete)}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Invite Member Dialog */}
      <InviteMemberDialog
        open={inviteDialogOpen}
        onOpenChange={setInviteDialogOpen}
        restaurantId={restaurant.id}
        onSuccess={fetchTeamData}
      />
    </div>
  );
}