import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { useAuth } from './AuthContext';

type Notification = {
  id: string;
  type: string;
  conversationId: string;
  isRead: boolean;
  createdAt: number;
  metadata?: {
    reason?: string;
    severity?: 'warning' | 'error'; // Severidade visual: warning (amarelo) ou error (vermelho)
    storeId?: string;
    storeName?: string;
    lastMessagePreview?: string;
  };
};

type NotificationContextType = {
  notifications: Notification[];
  unreadCount: number;
  handoffCount: number;
  refreshNotifications: () => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markConversationAsRead: (conversationId: string) => Promise<void>;
  playNotificationSound: () => void;
};

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const { token, clearAuth } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const lastSoundTimeRef = useRef<number>(0);
  const previousNotificationIdsRef = useRef<Set<string>>(new Set());
  const audioContextRef = useRef<AudioContext | null>(null);

  const playNotificationSound = async () => {
    try {
      // Criar ou reutilizar AudioContext (singleton)
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      const audioContext = audioContextRef.current;
      
      // Se o contexto estiver suspenso, tentar resumir
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }
      
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 800; // Frequência do "ping"
      oscillator.type = 'sine';
      
      // Volume aumentado: de 0.3 para 0.8 (mais alto)
      gainNode.gain.setValueAtTime(0.8, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.2);
      
      console.log('[NotificationContext] ✅ Som de notificação tocado');
    } catch (error) {
      console.error('[NotificationContext] ❌ Erro ao tocar som:', error);
    }
  };

  // Exportar função de teste de som globalmente
  if (typeof window !== 'undefined') {
    (window as any).testNotificationSound = playNotificationSound;
  }

  const fetchNotifications = async (): Promise<Notification[]> => {
    if (!token) {
      console.debug('[NotificationContext] No token available');
      return [];
    }

    try {
      const headers: HeadersInit = {
        'Authorization': `Bearer ${token}`,
      };
      const res = await fetch(`${API_BASE}/api/v1/notifications/unread`, { headers });
      
      if (!res.ok) {
        if (res.status === 401) {
          // Token inválido ou expirado - limpar autenticação
          console.warn('[NotificationContext] Token inválido ou expirado - limpando autenticação');
          clearAuth();
        }
        console.error('[NotificationContext] Failed to fetch notifications:', res.status, res.statusText);
        return [];
      }
      
      const data = await res.json();
      console.debug('[NotificationContext] Fetched notifications:', {
        success: data.success,
        count: Array.isArray(data.data) ? data.data.length : 0,
        notifications: data.data,
      });
      
      if (data.success && Array.isArray(data.data)) {
        return data.data;
      }
      return [];
    } catch (error) {
      console.error('[NotificationContext] Error fetching notifications:', error);
      return [];
    }
  };

  const refreshNotifications = async () => {
    const newNotifications = await fetchNotifications();
    
    // Detectar novas notificações handoff
    const currentIds = new Set(newNotifications.map(n => n.id));
    const previousIds = previousNotificationIdsRef.current;
    
    // Encontrar novas notificações handoff não lidas
    const newHandoffNotifications = newNotifications.filter(
      n => n.type === 'handoff_requested' && 
           !n.isRead && 
           !previousIds.has(n.id)
    );
    
    // Tocar som se houver novas notificações handoff (com debounce global)
    if (newHandoffNotifications.length > 0) {
      const now = Date.now();
      const timeSinceLastSound = now - lastSoundTimeRef.current;
      
      // Debounce: máximo 1 som a cada 30s globalmente
      // Só tocar se a página estiver visível
      if (timeSinceLastSound > 30000 && document.visibilityState === 'visible') {
        playNotificationSound();
        lastSoundTimeRef.current = now;
      }
    }
    
    // Atualizar referência de IDs anteriores
    previousNotificationIdsRef.current = currentIds;
    
    // Preservar notificações lidas que não estão mais na lista de não lidas
    // O endpoint /unread só retorna não lidas, então precisamos manter as lidas no estado
    setNotifications(prev => {
      const newIds = new Set(newNotifications.map(n => n.id));
      // Manter notificações lidas que não estão mais na lista de não lidas
      const keptReadNotifications = prev.filter(n => n.isRead && !newIds.has(n.id));
      // Combinar: novas não lidas + lidas preservadas
      return [...newNotifications, ...keptReadNotifications].sort((a, b) => b.createdAt - a.createdAt);
    });
  };

  const markAsRead = async (notificationId: string) => {
    if (!token) {
      console.error('[NotificationContext] No token available for markAsRead');
      return;
    }

    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      };
      
      const response = await fetch(`${API_BASE}/api/v1/notifications/${notificationId}/read`, {
        method: 'PATCH',
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[NotificationContext] Failed to mark notification as read:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData,
        });
        throw new Error(`Failed to mark notification as read: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      console.debug('[NotificationContext] Notification marked as read:', {
        notificationId,
        result,
      });
      
      // Atualizar estado local imediatamente
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n)
      );
    } catch (error) {
      console.error('[NotificationContext] Error marking notification as read:', error);
      throw error; // Re-throw para que o componente possa tratar
    }
  };

  const markConversationAsRead = async (conversationId: string) => {
    if (!token) return;

    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      };
      
      const response = await fetch(`${API_BASE}/api/v1/conversations/${conversationId}/notifications/read`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({}), // Body vazio para evitar erro do Fastify
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[NotificationContext] Failed to mark conversation notifications as read:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData,
        });
        return;
      }

      const result = await response.json();
      console.debug('[NotificationContext] Conversation notifications marked as read:', {
        conversationId,
        result,
      });
      
      // Atualizar estado local
      setNotifications(prev => 
        prev.map(n => n.conversationId === conversationId ? { ...n, isRead: true } : n)
      );
    } catch (error) {
      console.error('[NotificationContext] Error marking conversation notifications as read:', error);
    }
  };

  // Polling de notificações a cada 5 segundos
  useEffect(() => {
    if (!token) {
      console.debug('[NotificationContext] No token - skipping polling');
      return;
    }

    console.log('[NotificationContext] Starting notification polling...');
    refreshNotifications();
    const interval = setInterval(() => {
      refreshNotifications();
    }, 5000);

    return () => {
      console.log('[NotificationContext] Stopping notification polling');
      clearInterval(interval);
    };
  }, [token]);

  const unreadCount = notifications.filter(n => !n.isRead).length;
  const handoffCount = notifications.filter(n => n.type === 'handoff_requested' && !n.isRead).length;

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        handoffCount,
        refreshNotifications,
        markAsRead,
        markConversationAsRead,
        playNotificationSound,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
