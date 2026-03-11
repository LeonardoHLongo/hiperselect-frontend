/**
 * Hook customizado para monitorar status do WhatsApp em tempo real via SSE
 */

import { useState, useEffect, useCallback, useRef } from 'react';

type WhatsAppStatus = 'online' | 'offline' | 'connecting' | 'error';
type StatusReason = string;

interface WhatsAppStatusData {
  status: WhatsAppStatus;
  reason?: StatusReason;
  timestamp: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export function useWhatsAppStatus(token: string | null) {
  const [status, setStatus] = useState<WhatsAppStatus>('offline');
  const [reason, setReason] = useState<StatusReason | undefined>(undefined);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [hasReceivedInitialStatus, setHasReceivedInitialStatus] = useState(false);
  const reconnectAttemptsRef = useRef(0);

  useEffect(() => {
    if (!token) {
      setStatus('offline');
      setIsConnected(false);
      setHasReceivedInitialStatus(false);
      return;
    }
    
    // Resetar flag quando token mudar (nova conexão)
    setHasReceivedInitialStatus(false);

    let eventSource: EventSource | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;
    const maxReconnectAttempts = 5;
    const baseReconnectDelay = 3000; // 3 segundos

    const connect = () => {
      try {
        // Criar URL com token de autenticação via query param
        // (EventSource não suporta headers customizados nativamente)
        const url = `${API_BASE}/api/whatsapp/status/stream?token=${encodeURIComponent(token)}`;
        
        eventSource = new EventSource(url);

        eventSource.onopen = () => {
          console.log('[useWhatsAppStatus] ✅ Conectado ao stream de status');
          setIsConnected(true);
          setError(null);
          reconnectAttemptsRef.current = 0;
        };

        eventSource.onmessage = (event) => {
          try {
            // Ignorar heartbeats (mensagens que começam com ':')
            if (event.data.trim().startsWith(':')) {
              return;
            }
            
            const data: WhatsAppStatusData = JSON.parse(event.data);
            console.log('[useWhatsAppStatus] 📨 Status recebido:', data);
            console.log('[useWhatsAppStatus] Status atual antes:', status);
            console.log('[useWhatsAppStatus] hasReceivedInitialStatus antes:', hasReceivedInitialStatus);
            
            setStatus(data.status);
            setReason(data.reason);
            
            // Marcar que recebemos status inicial (sempre que receber uma mensagem válida)
            setHasReceivedInitialStatus(true);
            
            console.log('[useWhatsAppStatus] Status atualizado para:', data.status);
            console.log('[useWhatsAppStatus] hasReceivedInitialStatus atualizado para: true');
          } catch (err) {
            console.error('[useWhatsAppStatus] ❌ Erro ao parsear mensagem:', err);
          }
        };

        eventSource.onerror = (err) => {
          console.error('[useWhatsAppStatus] ❌ Erro no EventSource:', err);
          setIsConnected(false);
          setError(new Error('Erro na conexão com o servidor'));

          // Tentar reconectar
          if (reconnectAttemptsRef.current < maxReconnectAttempts) {
            reconnectAttemptsRef.current++;
            const delay = baseReconnectDelay * Math.pow(2, reconnectAttemptsRef.current - 1); // Exponential backoff
            console.log(`[useWhatsAppStatus] 🔄 Tentando reconectar em ${delay}ms (tentativa ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`);
            
            reconnectTimeout = setTimeout(() => {
              if (eventSource) {
                eventSource.close();
              }
              connect();
            }, delay);
          } else {
            console.error('[useWhatsAppStatus] ❌ Máximo de tentativas de reconexão atingido');
            setError(new Error('Não foi possível conectar ao servidor após múltiplas tentativas'));
          }
        };
      } catch (err) {
        console.error('[useWhatsAppStatus] ❌ Erro ao criar EventSource:', err);
        setError(err instanceof Error ? err : new Error('Erro desconhecido'));
        setIsConnected(false);
      }
    };

    connect();

    return () => {
      if (eventSource) {
        eventSource.close();
      }
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
    };
  }, [token]);

  const reconnect = useCallback(() => {
    // Forçar reconexão fechando e recriando
    setError(null);
    reconnectAttemptsRef.current = 0;
  }, []);

  return {
    status,
    reason,
    isConnected,
    error,
    hasReceivedInitialStatus,
    reconnect,
  };
}
