import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface InviteMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantId: string;
  onSuccess: () => void;
}

export function InviteMemberDialog({
  open,
  onOpenChange,
  restaurantId,
  onSuccess,
}: InviteMemberDialogProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('staff');
  const [permissions, setPermissions] = useState({
    menu: true,
    orders: true,
    settings: false,
    analytics: true,
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) {
      toast.error('Por favor, insira um email');
      return;
    }

    try {
      setLoading(true);

      const { data, error } = await supabase.functions.invoke('send-team-invitation', {
        body: {
          email,
          restaurantId,
          role,
          permissions,
        },
      });

      if (error) throw error;

      // Copy invitation URL to clipboard
      if (data.invitationUrl) {
        await navigator.clipboard.writeText(data.invitationUrl);
        toast.success('Link de convite copiado para a área de transferência!', {
          description: 'Envie este link para o convidado por email ou WhatsApp',
          duration: 8000,
        });
      } else {
        toast.success(data.message || 'Convite criado com sucesso!');
      }

      onSuccess();
      onOpenChange(false);
      resetForm();

    } catch (error) {
      console.error('Error sending invitation:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao enviar convite');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEmail('');
    setRole('staff');
    setPermissions({
      menu: true,
      orders: true,
      settings: false,
      analytics: true,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Convidar Membro</DialogTitle>
            <DialogDescription>
              Envie um convite para adicionar um novo membro à equipe
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="usuario@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Cargo</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger id="role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="staff">Membro</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="owner">Proprietário</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Permissões</Label>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="menu"
                    checked={permissions.menu}
                    onCheckedChange={(checked) =>
                      setPermissions((prev) => ({ ...prev, menu: !!checked }))
                    }
                  />
                  <Label htmlFor="menu" className="font-normal cursor-pointer">
                    Gerenciar Cardápio
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="orders"
                    checked={permissions.orders}
                    onCheckedChange={(checked) =>
                      setPermissions((prev) => ({ ...prev, orders: !!checked }))
                    }
                  />
                  <Label htmlFor="orders" className="font-normal cursor-pointer">
                    Gerenciar Pedidos
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="analytics"
                    checked={permissions.analytics}
                    onCheckedChange={(checked) =>
                      setPermissions((prev) => ({ ...prev, analytics: !!checked }))
                    }
                  />
                  <Label htmlFor="analytics" className="font-normal cursor-pointer">
                    Ver Analytics
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="settings"
                    checked={permissions.settings}
                    onCheckedChange={(checked) =>
                      setPermissions((prev) => ({ ...prev, settings: !!checked }))
                    }
                  />
                  <Label htmlFor="settings" className="font-normal cursor-pointer">
                    Configurações
                  </Label>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enviar Convite
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}