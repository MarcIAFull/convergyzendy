import { useState, useEffect } from 'react';
import { useRestaurantGuard } from '@/hooks/useRestaurantGuard';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Trash2, Mail, UserPlus, Copy, Users } from 'lucide-react';
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
import { useAuth } from '@/hooks/useAuth';
import { useIsMobile } from '@/hooks/use-mobile';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';

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
  token: string;
  created_at: string;
  expires_at: string;
}

export default function TeamManagement() {
  const { restaurant } = useRestaurantGuard();
  const { user } = useAuth();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [memberToDelete, setMemberToDelete] = useState<string | null>(null);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (restaurant?.id) {
      fetchTeamData();
    }
  }, [restaurant?.id]);

  const fetchTeamData = async () => {
    if (!restaurant?.id) return;

    try {
      setLoading(true);
      setError(null);

      // Fetch team members with emails using RPC function
      const { data: membersData, error: membersError } = await supabase
        .rpc('get_team_members_with_email', { 
          p_restaurant_id: restaurant.id 
        });

      if (membersError) {
        console.error('Error fetching members:', membersError);
        setError('Erro ao carregar membros da equipa');
        throw membersError;
      }

      setMembers(membersData || []);

      // Fetch pending invitations
      const { data: invitationsData, error: invitationsError } = await supabase
        .from('team_invitations')
        .select('id, email, role, status, token, created_at, expires_at')
        .eq('restaurant_id', restaurant.id)
        .eq('status', 'pending');

      if (invitationsError) {
        console.error('Error fetching invitations:', invitationsError);
        throw invitationsError;
      }

      setInvitations(invitationsData || []);

    } catch (error: any) {
      console.error('Error fetching team data:', error);
      toast.error(error.message || 'Erro ao carregar equipa');
      setError(error.message || 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const copyInvitationLink = async (token: string) => {
    const url = `${window.location.origin}/accept-invitation/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copiado para a área de transferência!');
    } catch (error) {
      toast.error('Erro ao copiar link');
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
    const labels: Record<string, string> = {
      owner: 'Proprietário',
      admin: 'Administrador',
      member: 'Membro'
    };
    return <Badge variant={variants[role] || 'outline'}>{labels[role] || role}</Badge>;
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "d 'de' MMM, yyyy", { locale: pt });
  };

  if (!restaurant) {
    return (
      <div className="container mx-auto py-8 px-4">
        <p className="text-muted-foreground">Selecione um restaurante primeiro</p>
      </div>
    );
  }

  // Mobile Card View for Members
  const MemberCard = ({ member }: { member: TeamMember }) => {
    const isCurrentUser = member.user_id === user?.id;
    return (
      <Card className="mb-3">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="font-medium truncate">{member.user_email}</span>
                {isCurrentUser && (
                  <Badge variant="secondary" className="text-xs">Você</Badge>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                {getRoleBadge(member.role)}
                <span>•</span>
                <span>{formatDate(member.created_at)}</span>
              </div>
            </div>
            {member.role !== 'owner' && !isCurrentUser && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMemberToDelete(member.id)}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  // Mobile Card View for Invitations
  const InvitationCard = ({ invitation }: { invitation: Invitation }) => (
    <Card className="mb-3">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="font-medium truncate">{invitation.email}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              {getRoleBadge(invitation.role)}
              <span>•</span>
              <span>Expira: {formatDate(invitation.expires_at)}</span>
            </div>
          </div>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => copyInvitationLink(invitation.token)}
              title="Copiar link do convite"
            >
              <Copy className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleDeleteInvitation(invitation.id)}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="container mx-auto py-6 md:py-8 px-4 space-y-6 md:space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Gestão de Equipa</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Gerencie membros e convites para {restaurant.name}
          </p>
        </div>
        <Button onClick={() => setInviteDialogOpen(true)} className="w-full sm:w-auto">
          <UserPlus className="mr-2 h-4 w-4" />
          Convidar Membro
        </Button>
      </div>

      {/* Error State */}
      {error && (
        <div className="p-4 bg-destructive/10 text-destructive rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Team Members */}
      <div className="space-y-4">
        <h2 className="text-lg md:text-xl font-semibold flex items-center gap-2">
          <Users className="h-5 w-5" />
          Membros Ativos
        </h2>
        
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton className="h-4 w-[200px] mb-2" />
                  <Skeleton className="h-3 w-[150px]" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : members.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              Nenhum membro encontrado
            </CardContent>
          </Card>
        ) : isMobile ? (
          // Mobile: Card Layout
          <div>
            {members.map((member) => (
              <MemberCard key={member.id} member={member} />
            ))}
          </div>
        ) : (
          // Desktop: Table Layout
          <div className="border rounded-lg overflow-hidden">
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
                {members.map((member) => {
                  const isCurrentUser = member.user_id === user?.id;
                  return (
                    <TableRow key={member.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {member.user_email}
                          {isCurrentUser && (
                            <Badge variant="secondary" className="text-xs">Você</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{getRoleBadge(member.role)}</TableCell>
                      <TableCell>{formatDate(member.created_at)}</TableCell>
                      <TableCell className="text-right">
                        {member.role !== 'owner' && !isCurrentUser && (
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
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Pending Invitations */}
      <div className="space-y-4">
        <h2 className="text-lg md:text-xl font-semibold flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Convites Pendentes
        </h2>
        
        {invitations.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              Nenhum convite pendente
            </CardContent>
          </Card>
        ) : isMobile ? (
          // Mobile: Card Layout
          <div>
            {invitations.map((invitation) => (
              <InvitationCard key={invitation.id} invitation={invitation} />
            ))}
          </div>
        ) : (
          // Desktop: Table Layout
          <div className="border rounded-lg overflow-hidden">
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
                {invitations.map((invitation) => (
                  <TableRow key={invitation.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        {invitation.email}
                      </div>
                    </TableCell>
                    <TableCell>{getRoleBadge(invitation.role)}</TableCell>
                    <TableCell>{formatDate(invitation.expires_at)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => copyInvitationLink(invitation.token)}
                          title="Copiar link do convite"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteInvitation(invitation.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!memberToDelete} onOpenChange={() => setMemberToDelete(null)}>
        <AlertDialogContent className="max-w-[95vw] sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Membro</AlertDialogTitle>
            <AlertDialogDescription>
              Tem a certeza de que pretende remover este membro? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
            <AlertDialogCancel className="w-full sm:w-auto">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => memberToDelete && handleDeleteMember(memberToDelete)}
              className="w-full sm:w-auto"
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