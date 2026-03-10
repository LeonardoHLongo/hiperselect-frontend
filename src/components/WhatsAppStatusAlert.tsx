/**
 * Componente de alerta para status do WhatsApp
 * Exibe barra fina e elegante no topo quando conexão está offline
 */

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { useWhatsAppStatus } from '../hooks/useWhatsAppStatus';
import { useAuth } from '../contexts/AuthContext';
import { WifiOff, Loader2 } from 'lucide-react';

// Chave para sessionStorage
const SUCCESS_MESSAGE_KEY = 'whatsapp_connection_success_shown';
const LAST_STATUS_KEY = 'whatsapp_last_status';

export function WhatsAppStatusAlert() {
  const router = useRouter();
  const { token } = useAuth();
  const { status, reason, isConnected, error, hasReceivedInitialStatus } = useWhatsAppStatus(token);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const prevStatusRef = useRef<string | null>(null);
  const hasInitializedRef = useRef<boolean>(false);

  // Detectar quando a conexão volta (transição de offline/error para online)
  useEffect(() => {
    if (!hasReceivedInitialStatus) return;

    // Inicializar na primeira vez
    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true;
      prevStatusRef.current = status;
      
      // Se já está online na montagem, marcar que já mostramos
      if (status === 'online') {
        if (typeof window !== 'undefined') {
          sessionStorage.setItem(SUCCESS_MESSAGE_KEY, 'true');
          sessionStorage.setItem(LAST_STATUS_KEY, status);
        }
      } else {
        // Se está offline, limpar a flag para permitir mostrar na próxima conexão
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem(SUCCESS_MESSAGE_KEY);
          sessionStorage.setItem(LAST_STATUS_KEY, status);
        }
      }
      return;
    }

    // Verificar se houve mudança de status
    const previousStatus = prevStatusRef.current;
    const wasOffline = previousStatus !== null && 
                       previousStatus !== 'online' && 
                       previousStatus !== 'connecting';

    // Só mostrar mensagem se:
    // 1. Status anterior era offline/error
    // 2. Status atual é online
    // 3. Ainda não mostramos a mensagem (verificar sessionStorage)
    if (wasOffline && status === 'online') {
      const hasShownSuccess = typeof window !== 'undefined' 
        ? sessionStorage.getItem(SUCCESS_MESSAGE_KEY) === 'true'
        : false;

      if (!hasShownSuccess) {
        setShowSuccessMessage(true);
        if (typeof window !== 'undefined') {
          sessionStorage.setItem(SUCCESS_MESSAGE_KEY, 'true');
        }
        const timer = setTimeout(() => {
          setShowSuccessMessage(false);
        }, 3000);
        return () => clearTimeout(timer);
      }
    }

    // Resetar flag quando desconectar novamente
    if (status === 'offline' || status === 'error') {
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem(SUCCESS_MESSAGE_KEY);
      }
    }

    // Atualizar status anterior
    prevStatusRef.current = status;
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(LAST_STATUS_KEY, status);
    }
  }, [status, hasReceivedInitialStatus]);

  const handleReconnect = () => {
    router.push('/settings');
  };

  // Não mostrar se:
  // - Estiver online e não houver mensagem de sucesso
  // - Não houver token
  // - Ainda não recebeu status inicial
  if ((status === 'online' && !showSuccessMessage) || !token || !hasReceivedInitialStatus) {
    return null;
  }

  // Determinar cor e conteúdo baseado no status
  let bgColor = '';
  let text = '';
  let icon = null;
  let showReconnectLink = false;

  if (showSuccessMessage) {
    // Feedback de reconexão bem-sucedida
    bgColor = 'bg-emerald-500/90 backdrop-blur-sm';
    text = 'Conexão restabelecida';
    icon = null;
    showReconnectLink = false;
  } else if (status === 'connecting') {
    // Reconectando
    bgColor = 'bg-amber-500/90 backdrop-blur-sm';
    text = 'Restabelecendo conexão com WhatsApp...';
    icon = <Loader2 className="w-4 h-4 animate-spin" />;
    showReconnectLink = false;
  } else if (status === 'offline' || status === 'error') {
    // Desconectado/Erro
    bgColor = 'bg-red-500/90 backdrop-blur-sm';
    text = 'WhatsApp desconectado';
    icon = <WifiOff className="w-4 h-4" />;
    showReconnectLink = true;
  } else {
    return null;
  }

  return (
    <div 
      className={`fixed top-16 left-[260px] right-0 h-10 z-50 ${bgColor} text-white flex items-center justify-center animate-slide-in-from-top`}
    >
      <div className="flex items-center gap-2 text-sm font-medium">
        {icon}
        <span>{text}</span>
        {showReconnectLink && (
          <>
            <span className="text-white/70">•</span>
            <button
              onClick={handleReconnect}
              className="underline underline-offset-2 hover:text-white/90 transition-colors"
            >
              Tentar agora
            </button>
          </>
        )}
      </div>
    </div>
  );
}
