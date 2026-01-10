import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import type { EnrichedConversation, CustomerDetails, CartItemWithDetails } from '@/types/conversation';

// AbortController for cancelling in-flight requests
let abortController: AbortController | null = null;
// Track active channels for cleanup
let activeChannels: any[] = [];

interface ConversationsStore {
  conversations: EnrichedConversation[];
  selectedPhone: string | null;
  customerDetails: CustomerDetails | null;
  loading: boolean;
  
  loadConversations: (restaurantId: string) => Promise<void>;
  selectConversation: (phone: string | null) => void;
  loadCustomerDetails: (phone: string, restaurantId: string) => Promise<void>;
  toggleMode: (phone: string, restaurantId: string, mode: 'ai' | 'manual') => Promise<void>;
  subscribeToConversations: (restaurantId: string) => () => void;
  subscribeToCustomerDetails: (phone: string, restaurantId: string) => () => void;
  reset: () => void;
}

export const useConversationsStore = create<ConversationsStore>((set, get) => ({
  conversations: [],
  selectedPhone: null,
  customerDetails: null,
  loading: false,

  reset: () => {
    console.log('[ConversationsStore] 🧹 Resetting store');
    
    // Cancel any in-flight requests
    abortController?.abort();
    abortController = null;
    
    // Remove all active channels
    activeChannels.forEach(channel => {
      supabase.removeChannel(channel);
    });
    activeChannels = [];
    
    set({
      conversations: [],
      selectedPhone: null,
      customerDetails: null,
      loading: false,
    });
  },

  loadConversations: async (restaurantId: string) => {
    // Cancel previous request
    abortController?.abort();
    abortController = new AbortController();
    const signal = abortController.signal;

    set({ loading: true });
    try {
      // Buscar todas as mensagens do restaurante
      const { data: messages, error: messagesError } = await supabase
        .from('messages')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('timestamp', { ascending: false })
        .abortSignal(signal);

      if (messagesError) throw messagesError;
      if (signal.aborted) return;

      // Agrupar por telefone
      const conversationMap = new Map<string, any>();
      
      messages?.forEach(msg => {
        const phone = msg.direction === 'incoming' || msg.direction === 'inbound' 
          ? msg.from_number 
          : msg.to_number;
        if (!conversationMap.has(phone)) {
          conversationMap.set(phone, {
            userPhone: phone,
            lastMessage: msg.body,
            lastTimestamp: msg.timestamp,
            unreadCount: 0,
          });
        }
      });

      const phones = Array.from(conversationMap.keys());
      if (signal.aborted) return;

      // Buscar dados dos clientes
      const { data: customers } = await supabase
        .from('customers')
        .select('phone, name')
        .in('phone', phones)
        .abortSignal(signal);

      if (signal.aborted) return;

      // Buscar estados das conversas
      const { data: states } = await supabase
        .from('conversation_state')
        .select('user_phone, state, cart_id')
        .eq('restaurant_id', restaurantId)
        .in('user_phone', phones)
        .abortSignal(signal);

      if (signal.aborted) return;

      // Buscar modos de conversa
      const { data: modes } = await supabase
        .from('conversation_mode')
        .select('user_phone, mode')
        .eq('restaurant_id', restaurantId)
        .in('user_phone', phones)
        .abortSignal(signal);

      if (signal.aborted) return;

      // Enriquecer conversas
      const enrichedConversations: EnrichedConversation[] = Array.from(conversationMap.values()).map(conv => {
        const customer = customers?.find(c => c.phone === conv.userPhone);
        const state = states?.find(s => s.user_phone === conv.userPhone);
        const mode = modes?.find(m => m.user_phone === conv.userPhone);

        return {
          ...conv,
          customerName: customer?.name || null,
          conversationState: state?.state || 'idle',
          mode: mode?.mode || 'ai',
          hasActiveCart: !!state?.cart_id,
          isOnline: false,
        };
      });

      set({ conversations: enrichedConversations, loading: false });
    } catch (error) {
      // Ignore abort errors
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('[ConversationsStore] Request aborted');
        return;
      }
      console.error('Error loading conversations:', error);
      set({ loading: false });
    }
  },

  selectConversation: (phone: string | null) => {
    set({ selectedPhone: phone, customerDetails: phone ? get().customerDetails : null });
  },

  loadCustomerDetails: async (phone: string, restaurantId: string) => {
    try {
      // Buscar dados do cliente
      const { data: customer } = await supabase
        .from('customers')
        .select('*')
        .eq('phone', phone)
        .eq('restaurant_id', restaurantId)
        .single();

      // Buscar estado da conversa
      const { data: state } = await supabase
        .from('conversation_state')
        .select('state, cart_id, updated_at')
        .eq('user_phone', phone)
        .eq('restaurant_id', restaurantId)
        .single();

      let cart = null;

      // Se há carrinho ativo, buscar itens
      if (state?.cart_id) {
        const { data: cartData } = await supabase
          .from('carts')
          .select('*')
          .eq('id', state.cart_id)
          .single();

        if (cartData) {
          const { data: items } = await supabase
            .from('cart_items')
            .select(`
              *,
              product:products(*),
              addons:cart_item_addons(addon:addons(*))
            `)
            .eq('cart_id', state.cart_id);

          const itemsWithDetails: CartItemWithDetails[] = items?.map(item => ({
            ...item,
            product: item.product,
            addons: item.addons?.map((a: any) => a.addon) || [],
          })) || [];

          cart = {
            ...cartData,
            items: itemsWithDetails,
          };
        }
      }

      const details: CustomerDetails = {
        phone,
        name: customer?.name || null,
        conversationState: state?.state || 'idle',
        lastInteraction: state?.updated_at || new Date().toISOString(),
        cart,
      };

      set({ customerDetails: details });
    } catch (error) {
      console.error('Error loading customer details:', error);
    }
  },

  toggleMode: async (phone: string, restaurantId: string, mode: 'ai' | 'manual') => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('conversation_mode')
        .upsert({
          restaurant_id: restaurantId,
          user_phone: phone,
          mode,
          taken_over_by: mode === 'manual' ? user?.id : null,
          taken_over_at: mode === 'manual' ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'restaurant_id,user_phone'
        });

      if (error) throw error;

      // Atualizar localmente
      set(state => ({
        conversations: state.conversations.map(conv =>
          conv.userPhone === phone ? { ...conv, mode } : conv
        ),
      }));
    } catch (error) {
      console.error('Error toggling mode:', error);
      throw error;
    }
  },

  subscribeToConversations: (restaurantId: string) => {
    const channel = supabase
      .channel(`conversations-realtime-${restaurantId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `restaurant_id=eq.${restaurantId}`
      }, (payload) => {
        console.log('New message detected:', payload);
        get().loadConversations(restaurantId);
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'conversation_mode',
        filter: `restaurant_id=eq.${restaurantId}`
      }, (payload) => {
        console.log('Conversation mode changed:', payload);
        get().loadConversations(restaurantId);
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'conversation_state',
        filter: `restaurant_id=eq.${restaurantId}`
      }, (payload) => {
        console.log('Conversation state changed:', payload);
        get().loadConversations(restaurantId);
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'customers'
      }, (payload) => {
        console.log('Customer updated:', payload);
        get().loadConversations(restaurantId);
      })
      .subscribe();

    // Track channel for cleanup
    activeChannels.push(channel);

    return () => {
      supabase.removeChannel(channel);
      activeChannels = activeChannels.filter(c => c !== channel);
    };
  },

  subscribeToCustomerDetails: (phone: string, restaurantId: string) => {
    const channel = supabase
      .channel(`customer-details-${phone}-${restaurantId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'cart_items'
      }, (payload) => {
        console.log('Cart items changed:', payload);
        get().loadCustomerDetails(phone, restaurantId);
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'carts',
        filter: `user_phone=eq.${phone}`
      }, (payload) => {
        console.log('Cart updated:', payload);
        get().loadCustomerDetails(phone, restaurantId);
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'customers',
        filter: `phone=eq.${phone}`
      }, (payload) => {
        console.log('Customer info updated:', payload);
        get().loadCustomerDetails(phone, restaurantId);
      })
      .subscribe();

    // Track channel for cleanup
    activeChannels.push(channel);

    return () => {
      supabase.removeChannel(channel);
      activeChannels = activeChannels.filter(c => c !== channel);
    };
  },
}));
