import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { useRestaurantStore } from '@/stores/restaurantStore';
import { useUserRestaurantsStore } from '@/stores/userRestaurantsStore';
import { Loader2, CheckCircle2, XCircle, Copy } from 'lucide-react';
import { toast } from 'sonner';

const INVITATION_TOKEN_KEY = 'pending_invitation_token';
const JUST_ACCEPTED_KEY = 'just_accepted_invitation';
const ACTIVE_RESTAURANT_KEY = 'zendy_active_restaurant';

export function savePendingInvitationToken(token: string) {
  localStorage.setItem(INVITATION_TOKEN_KEY, token);
}

export function getPendingInvitationToken(): string | null {
  return localStorage.getItem(INVITATION_TOKEN_KEY);
}

export function clearPendingInvitationToken() {
  localStorage.removeItem(INVITATION_TOKEN_KEY);
}

export function setJustAcceptedInvitation() {
  sessionStorage.setItem(JUST_ACCEPTED_KEY, 'true');
}

export function getAndClearJustAcceptedInvitation(): boolean {
  const value = sessionStorage.getItem(JUST_ACCEPTED_KEY);
  if (value) {
    sessionStorage.removeItem(JUST_ACCEPTED_KEY);
    return true;
  }
  return false;
}

export default function AcceptInvitation() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const setRestaurant = useRestaurantStore(state => state.setRestaurant);
  const addRestaurant = useUserRestaurantsStore(state => state.addRestaurant);
  const [loading, setLoading] = useState(true);
  const [invitation, setInvitation] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (token) {
      // Save token so we can return after login/signup
      savePendingInvitationToken(token);
      fetchInvitation();
    }
  }, [token]);

  const fetchInvitation = async () => {
    if (!token) return;

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('team_invitations')
        .select(`
          id,
          email,
          role,
          status,
          expires_at,
          restaurant_id,
          restaurants:restaurant_id (
            id,
            name,
            phone,
            address,
            delivery_fee,
            is_open,
            opening_hours,
            slug,
            created_at,
            updated_at,
            user_id,
            latitude,
            longitude,
            google_place_id,
            stripe_customer_id
          )
        `)
        .eq('token', token)
        .eq('status', 'pending')
        .maybeSingle();

      if (fetchError) {
        console.error('Error fetching invitation:', fetchError);
        setError('Erro ao carregar convite');
        return;
      }

      if (!data) {
        setError('Convite não encontrado ou já foi aceito');
        clearPendingInvitationToken();
        return;
      }

      if (new Date(data.expires_at) < new Date()) {
        setError('Este convite expirou');
        clearPendingInvitationToken();
        return;
      }

      setInvitation(data);

      // If user is logged in and email matches, auto-accept
      if (user && user.email === data.email) {
        await handleAccept(data);
      }

    } catch (error: any) {
      console.error('Error fetching invitation:', error);
      setError(error.message || 'Erro ao carregar convite');
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (invitationData?: any) => {
    if (!token) return;

    const currentInvitation = invitationData || invitation;

    try {
      setLoading(true);
      setError(null);

      const { data, error: acceptError } = await supabase.functions.invoke(
        'accept-team-invitation',
        {
          body: { token },
        }
      );

      if (acceptError) {
        console.error('Error invoking accept function:', acceptError);
        throw acceptError;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      // Get the full restaurant data from the invitation we already fetched
      const restaurant = currentInvitation?.restaurants;
      
      if (restaurant) {
        console.log('[AcceptInvitation] Setting restaurant in stores:', restaurant.name);
        
        // Update userRestaurantsStore
        addRestaurant(restaurant);
        
        // Set as active restaurant in restaurantStore
        setRestaurant(restaurant);
        
        // Also save to localStorage for persistence
        localStorage.setItem(ACTIVE_RESTAURANT_KEY, restaurant.id);
      }

      // Set flag so ProtectedRoute knows to skip restaurant check
      setJustAcceptedInvitation();
      
      // Clear pending token after successful acceptance
      clearPendingInvitationToken();
      
      setSuccess(true);
      toast.success('Convite aceito com sucesso!');
      
      setTimeout(() => {
        navigate('/dashboard');
      }, 1500);

    } catch (error: any) {
      console.error('Error accepting invitation:', error);
      setError(error.message || 'Erro ao aceitar convite');
      setLoading(false);
    }
  };

  const handleGoToLogin = () => {
    // Token is already saved in localStorage
    navigate('/login');
  };

  const handleGoToSignup = () => {
    // Token is already saved, navigate to signup tab
    navigate('/login?tab=signup&invite=true');
  };

  const copyInvitationLink = async () => {
    try {
      const url = window.location.href;
      await navigator.clipboard.writeText(url);
      toast.success('Link copiado!');
    } catch (error) {
      toast.error('Erro ao copiar link');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground">Carregando convite...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center space-y-4">
              <CheckCircle2 className="h-16 w-16 text-green-500" />
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold">Convite Aceito!</h2>
                <p className="text-muted-foreground">
                  Você foi adicionado ao restaurante. Redirecionando...
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center space-y-4">
              <XCircle className="h-16 w-16 text-destructive" />
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold">Erro</h2>
                <p className="text-muted-foreground">{error}</p>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => navigate('/login')} variant="outline">
                  Ir para Login
                </Button>
                <Button onClick={copyInvitationLink} variant="ghost" size="icon">
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Convite para {invitation?.restaurants?.name}</CardTitle>
            <CardDescription>
              Você foi convidado para se juntar à equipe como {invitation?.role}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Email do convite: <strong>{invitation?.email}</strong>
            </p>
            <div className="space-y-2">
              <Button onClick={handleGoToLogin} className="w-full">
                Fazer Login para Aceitar
              </Button>
              <Button
                onClick={handleGoToSignup}
                variant="outline"
                className="w-full"
              >
                Criar Conta
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (user.email !== invitation?.email) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center space-y-4">
              <XCircle className="h-16 w-16 text-destructive" />
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold">Email Incorreto</h2>
                <p className="text-muted-foreground">
                  Este convite foi enviado para {invitation?.email}, mas você está logado como{' '}
                  {user.email}
                </p>
              </div>
              <Button onClick={() => navigate('/dashboard')} variant="outline">
                Voltar ao Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Convite para {invitation?.restaurants?.name}</CardTitle>
          <CardDescription>
            Você foi convidado para se juntar à equipe como {invitation?.role}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 text-sm">
            <p>
              <strong>Email:</strong> {invitation?.email}
            </p>
            <p>
              <strong>Cargo:</strong> {invitation?.role}
            </p>
          </div>
          <Button onClick={() => handleAccept()} className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Aceitar Convite
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
