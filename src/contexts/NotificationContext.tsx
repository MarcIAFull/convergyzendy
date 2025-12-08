import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useRestaurantStore } from '@/stores/restaurantStore';
import { toast } from 'sonner';
import { RealtimeChannel } from '@supabase/supabase-js';

interface NotificationContextType {
  unreadOrders: number;
  unreadMessages: number;
  unreadHandoffs: number;
  soundEnabled: boolean;
  toggleSound: () => void;
  markOrdersRead: () => void;
  markMessagesRead: () => void;
  markHandoffsRead: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
};

interface NotificationProviderProps {
  children: ReactNode;
}

export const NotificationProvider = ({ children }: NotificationProviderProps) => {
  const { user } = useAuth();
  const { restaurant } = useRestaurantStore();
  const [unreadOrders, setUnreadOrders] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [unreadHandoffs, setUnreadHandoffs] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [ordersChannel, setOrdersChannel] = useState<RealtimeChannel | null>(null);
  const [messagesChannel, setMessagesChannel] = useState<RealtimeChannel | null>(null);
  const [handoffChannel, setHandoffChannel] = useState<RealtimeChannel | null>(null);

  // Load notification preferences
  useEffect(() => {
    if (!user) return;

    const loadPreferences = async () => {
      const { data } = await supabase
        .from('notification_preferences')
        .select('sound_enabled')
        .eq('user_id', user.id)
        .single();

      if (data) {
        setSoundEnabled(data.sound_enabled);
      } else {
        // Create default preferences
        await supabase
          .from('notification_preferences')
          .insert({
            user_id: user.id,
            sound_enabled: true,
            new_order_enabled: true,
            new_message_enabled: true,
            recovery_enabled: true
          });
      }
    };

    loadPreferences();
  }, [user]);

  // Play notification sound
  const playNotificationSound = useCallback(() => {
    if (!soundEnabled) return;
    
    try {
      const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIGGi77eahTBENUKnn77RgGwU7k9zxxHQpBSl+y/DcjD0IFmG45eh9Kg0NVKzn6qNUEQpGnuDzu2weBCuBzvLZiTYIGGi77eahTBENUKnn77RgGwU7k9zxxHQpBSl+y/DcjD0IFmG45eh9Kg0NVKzn6qNUEQpGnuDzu2weBCuBzvLZiTYIGGi77eahTBENUKnn77RgGwU7k9zxxHQpBSl+y/DcjD0IFmG45eh9Kg0NVKzn6qNUEQpGnuDzu2weBCuBzvLZiTYIGGi77eahTBENUKnn77RgGwU7k9zxxHQpBSl+y/DcjD0IFmG45eh9Kg0NVKzn6qNUEQpGnuDzu2weBCuBzvLZiTYIGGi77eahTBENUKnn77RgGwU7k9zxxHQpBSl+y/DcjD0IFmG45eh9Kg0NVKzn6qNUEQpGnuDzu2weBCuBzvLZiTYIGGi77eahTBENUKnn77RgGwU7k9zxxHQpBSl+y/DcjD0IFmG45eh9Kg0NVKzn6qNUEQpGnuDzu2weBCuBzvLZiTYIGGi77eahTBENUKnn77RgGwU7k9zxxHQpBSl+y/DcjD0IFmG45eh9Kg0NVKzn6qNUEQpGnuDzu2weBCuBzvLZiTYIGGi77eahTBENUKnn77RgGwU7k9zxxHQpBSl+y/DcjD0IFmG45eh9Kg0NVKzn6qNUEQpGnuDzu2weBCuBzvLZiTYIGGi77eahTBENUKnn77RgGwU7k9zxxHQpBSl+y/DcjD0I=');
      audio.volume = 0.5;
      audio.play().catch(e => console.log('Could not play sound:', e));
    } catch (e) {
      console.log('Sound not supported:', e);
    }
  }, [soundEnabled]);

  // Play urgent notification sound for handoffs (triple beep)
  const playUrgentSound = useCallback(() => {
    if (!soundEnabled) return;
    
    try {
      const playOnce = () => {
        const audio = new Audio('/notification-sound.mp3');
        audio.volume = 0.8;
        audio.play().catch(e => console.log('Could not play urgent sound:', e));
      };
      playOnce();
      setTimeout(playOnce, 300);
      setTimeout(playOnce, 600);
    } catch (e) {
      console.log('Urgent sound not supported:', e);
    }
  }, [soundEnabled]);

  // Subscribe to new orders
  useEffect(() => {
    if (!restaurant?.id) return;

    console.log('[Notifications] Setting up orders subscription for restaurant:', restaurant.id);

    const channel = supabase
      .channel('orders-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders',
          filter: `restaurant_id=eq.${restaurant.id}`
        },
        (payload) => {
          console.log('[Notifications] New order received:', payload);
          
          setUnreadOrders(prev => prev + 1);
          playNotificationSound();
          
          toast.success('Novo Pedido!', {
            description: `Pedido #${payload.new.id.substring(0, 8)} recebido`,
            duration: 5000,
          });
        }
      )
      .subscribe();

    setOrdersChannel(channel);

    return () => {
      console.log('[Notifications] Cleaning up orders subscription');
      supabase.removeChannel(channel);
    };
  }, [restaurant?.id, playNotificationSound]);

  // Subscribe to new messages
  useEffect(() => {
    if (!restaurant?.id) return;

    console.log('[Notifications] Setting up messages subscription for restaurant:', restaurant.id);

    const channel = supabase
      .channel('messages-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `restaurant_id=eq.${restaurant.id}`
        },
        (payload) => {
          console.log('[Notifications] New message received:', payload);
          
          // Only notify for inbound messages
          if (payload.new.direction === 'inbound') {
            setUnreadMessages(prev => prev + 1);
            playNotificationSound();
            
            toast.info('Nova Mensagem', {
              description: `De: ${payload.new.from_number}`,
              duration: 4000,
            });
          }
        }
      )
      .subscribe();

    setMessagesChannel(channel);

    return () => {
      console.log('[Notifications] Cleaning up messages subscription');
      supabase.removeChannel(channel);
    };
  }, [restaurant?.id, playNotificationSound]);

  // Subscribe to handoff requests (via system_logs)
  useEffect(() => {
    if (!restaurant?.id) return;

    console.log('[Notifications] Setting up handoff subscription for restaurant:', restaurant.id);

    const channel = supabase
      .channel('handoff-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'system_logs',
          filter: `restaurant_id=eq.${restaurant.id}`
        },
        (payload) => {
          // Only process handoff_requested logs
          if (payload.new.log_type !== 'handoff_requested') return;
          
          console.log('[Notifications] 🚨 Handoff requested:', payload);
          
          setUnreadHandoffs(prev => prev + 1);
          playUrgentSound();
          
          const metadata = payload.new.metadata as any;
          const reasonLabels: Record<string, string> = {
            'customer_request': 'Cliente pediu atendente',
            'aggressive_tone': 'Cliente frustrado',
            'ai_limitation': 'IA não conseguiu resolver',
            'repeated_confusion': 'Confusão repetida'
          };
          
          toast.error('🚨 Handoff Solicitado!', {
            description: `${metadata?.customer_name || metadata?.customer_phone || 'Cliente'}: ${reasonLabels[metadata?.reason] || metadata?.reason}`,
            duration: 15000,
            action: {
              label: 'Ver Mensagens',
              onClick: () => window.location.href = '/messages'
            }
          });
        }
      )
      .subscribe();

    setHandoffChannel(channel);

    return () => {
      console.log('[Notifications] Cleaning up handoff subscription');
      supabase.removeChannel(channel);
    };
  }, [restaurant?.id, playUrgentSound]);

  const toggleSound = useCallback(async () => {
    if (!user) return;

    const newValue = !soundEnabled;
    setSoundEnabled(newValue);

    await supabase
      .from('notification_preferences')
      .upsert({
        user_id: user.id,
        sound_enabled: newValue
      }, {
        onConflict: 'user_id'
      });

    toast.success(newValue ? 'Som ativado' : 'Som desativado');
  }, [soundEnabled, user]);

  const markOrdersRead = useCallback(() => {
    setUnreadOrders(0);
  }, []);

  const markMessagesRead = useCallback(() => {
    setUnreadMessages(0);
  }, []);

  const markHandoffsRead = useCallback(() => {
    setUnreadHandoffs(0);
  }, []);

  return (
    <NotificationContext.Provider
      value={{
        unreadOrders,
        unreadMessages,
        unreadHandoffs,
        soundEnabled,
        toggleSound,
        markOrdersRead,
        markMessagesRead,
        markHandoffsRead,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};
