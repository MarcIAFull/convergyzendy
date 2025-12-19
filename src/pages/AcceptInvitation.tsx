import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { useRestaurantStore } from '@/stores/restaurantStore';
import { useUserRestaurantsStore } from '@/stores/userRestaurantsStore';
import { Loader2, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
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

interface InvitationData {
  id: string;
  email: string;
  role: string;
  status: string;
  expires_at: string;
  restaurant_id: string;
  restaurants: {
    id: string;
    name: string;
    phone: string;
    address: string;
    delivery_fee: number;
    is_open: boolean;
    opening_hours: any;
    slug: string | null;
    created_at: string;
    updated_at: string;
    user_id: string;
    latitude: number | null;
    longitude: number | null;
    google_place_id: string | null;
    stripe_customer_id: string | null;
  } | null;
}

export default function AcceptInvitation() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const setRestaurant = useRestaurantStore(state => state.setRestaurant);
  const addRestaurant = useUserRestaurantsStore(state => state.addRestaurant);
  
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Fetch invitation details on mount
  useEffect(() => {
    if (token) {
      savePendingInvitationToken(token);
      fetchInvitation();
    }
  }, [token]);

  // Auto-accept when user is logged in and email matches
  useEffect(() => {
    if (!authLoading && user && invitation && user.email?.toLowerCase() === invitation.email.toLowerCase() && !accepting && !success) {
      handleAccept();
    }
  }, [user, authLoading, invitation, accepting, success]);

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
        console.error('[AcceptInvitation] Error fetching invitation:', fetchError);
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

      setInvitation(data as InvitationData);

    } catch (error: any) {
      console.error('[AcceptInvitation] Error:', error);
      setError(error.message || 'Erro ao carregar convite');
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!token || !user || accepting) return;

    try {
      setAccepting(true);
      setError(null);

      const { data, error: acceptError } = await supabase.functions.invoke(
        'accept-team-invitation',
        { body: { token } }
      );

      if (acceptError) {
        console.error('[AcceptInvitation] Function error:', acceptError);
        throw new Error(acceptError.message || 'Erro ao aceitar convite');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      // Get restaurant from response or from invitation
      const restaurant = data?.restaurant || invitation?.restaurants;
      
      if (restaurant) {
        console.log('[AcceptInvitation] Setting restaurant:', restaurant.name);
        addRestaurant(restaurant);
        setRestaurant(restaurant);
        localStorage.setItem(ACTIVE_RESTAURANT_KEY, restaurant.id);
      }

      setJustAcceptedInvitation();
      clearPendingInvitationToken();
      setSuccess(true);
      
      toast.success(data?.alreadyMember ? 'Você já era membro!' : 'Convite aceito com sucesso!');
      
      setTimeout(() => {
        navigate('/dashboard');
      }, 1500);

    } catch (error: any) {
      console.error('[AcceptInvitation] Error accepting:', error);
      setError(error.message || 'Erro ao aceitar convite');
      setAccepting(false);
    }
  };

  const handleGoToLogin = () => {
    navigate('/login');
  };

  const handleGoToSignup = () => {
    navigate('/login?tab=signup&invite=true');
  };

  // Loading state
  if (loading || authLoading) {
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

  // Success state
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

  // Error state
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
              <Button onClick={() => navigate('/login')} variant="outline">
                Ir para Login
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // No user - show login/signup options
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
              <Button onClick={handleGoToSignup} variant="outline" className="w-full">
                Criar Conta
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // User logged in but email doesn't match
  if (user.email?.toLowerCase() !== invitation?.email.toLowerCase()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center space-y-4">
              <AlertCircle className="h-16 w-16 text-yellow-500" />
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold">Email Diferente</h2>
                <p className="text-muted-foreground">
                  Este convite foi enviado para <strong>{invitation?.email}</strong>, 
                  mas você está logado como <strong>{user.email}</strong>
                </p>
                <p className="text-sm text-muted-foreground">
                  Por favor, faça logout e entre com a conta correta.
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

  // Accepting state
  if (accepting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground">Aceitando convite...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Manual accept (shouldn't normally reach here due to auto-accept)
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
            <p><strong>Email:</strong> {invitation?.email}</p>
            <p><strong>Cargo:</strong> {invitation?.role}</p>
          </div>
          <Button onClick={handleAccept} className="w-full" disabled={accepting}>
            {accepting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Aceitar Convite
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
