import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useRestaurantStore } from '@/stores/restaurantStore';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, metadata?: any) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  
  const lastSessionIdRef = useRef<string | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    let isMounted = true;

    // 1. Register listener FIRST (recommended pattern)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!isMounted) return;

      const newSessionId = newSession?.access_token ?? null;

      // Deduplicate: skip if session hasn't actually changed
      if (initializedRef.current && newSessionId === lastSessionIdRef.current) {
        return;
      }

      lastSessionIdRef.current = newSessionId;

      if (_event === 'SIGNED_OUT') {
        useRestaurantStore.getState().clearRestaurant();
        setSession(null);
        setUser(null);
      } else {
        setSession(newSession);
        setUser(newSession?.user ?? null);
      }

      // Mark loading false only once
      if (!initializedRef.current) {
        initializedRef.current = true;
        setLoading(false);
      }
    });

    // 2. Then get initial session (acts as fallback if INITIAL_SESSION is delayed)
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      if (!isMounted) return;
      // Only use if listener hasn't fired yet
      if (!initializedRef.current) {
        lastSessionIdRef.current = currentSession?.access_token ?? null;
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        initializedRef.current = true;
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success('Login realizado com sucesso!');
      navigate('/dashboard');
    } catch (error: any) {
      console.error('Sign in error:', error);
      if (error.message.includes('Invalid login credentials')) {
        throw new Error('Email ou senha inválidos');
      }
      throw new Error(error.message || 'Erro ao fazer login');
    }
  };

  const signUp = async (email: string, password: string, metadata?: any) => {
    try {
      const { error } = await supabase.auth.signUp({
        email, password,
        options: { data: metadata, emailRedirectTo: `${window.location.origin}/` },
      });
      if (error) throw error;
      toast.success('Conta criada! Verifique seu email.');
      navigate('/onboarding');
    } catch (error: any) {
      console.error('Sign up error:', error);
      if (error.message.includes('already registered')) {
        throw new Error('Este email já está cadastrado');
      }
      throw new Error(error.message || 'Erro ao criar conta');
    }
  };

  const signOut = async () => {
    try {
      useRestaurantStore.getState().clearRestaurant();
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      toast.success('Logout realizado com sucesso!');
      navigate('/login');
    } catch (error: any) {
      console.error('Sign out error:', error);
      toast.error('Erro ao fazer logout');
    }
  };

  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success('Email de recuperação enviado!');
    } catch (error: any) {
      console.error('Reset password error:', error);
      throw new Error(error.message || 'Erro ao enviar email de recuperação');
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut, resetPassword }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
