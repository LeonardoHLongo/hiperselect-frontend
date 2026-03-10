import { Fragment } from 'react';
import { useRouter } from 'next/router';
import { useNotifications } from '../contexts/NotificationContext';

type NotificationModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export const NotificationModal = ({ isOpen, onClose }: NotificationModalProps) => {
  const router = useRouter();
  const { notifications, markAsRead, refreshNotifications } = useNotifications();

  const handleNotificationClick = async (notification: any) => {
    // Marcar como lida apenas quando o usuário clicar
    if (!notification.isRead) {
      try {
        await markAsRead(notification.id);
        console.debug('[NotificationModal] Notificação marcada como lida:', notification.id);
        // Aguardar um pouco antes de recarregar para garantir que o backend processou
        await new Promise(resolve => setTimeout(resolve, 200));
        // Recarregar notificações para sincronizar com o backend
        await refreshNotifications();
      } catch (error) {
        console.error('[NotificationModal] Erro ao marcar notificação como lida:', error);
        // Mesmo com erro, continuar o fluxo (fechar modal e redirecionar)
      }
    }
    
    // Fechar modal
    onClose();
    // Redirecionar para a conversa
    router.push(`/conversations/${notification.conversationId}`);
  };

  if (!isOpen) return null;

  // Separar notificações em não lidas e lidas
  const unreadNotifications = notifications.filter(n => !n.isRead);
  const readNotifications = notifications.filter(n => n.isRead);

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[80vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Notificações
              {unreadNotifications.length > 0 && (
                <span className="ml-2 text-sm font-normal text-gray-500">
                  ({unreadNotifications.length} não lida{unreadNotifications.length > 1 ? 's' : ''})
                </span>
              )}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500 focus:outline-none"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {notifications.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                  />
                </svg>
                <p className="mt-2">Nenhuma notificação</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Seção: Notificações Não Lidas */}
                {unreadNotifications.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
                      Não Lidas ({unreadNotifications.length})
                    </h3>
                    <div className="space-y-3">
                      {unreadNotifications.map((notification) => {
                        // Determinar cor baseada na severidade
                        const severity = notification.metadata?.severity || 'warning';
                        const isError = severity === 'error'; // Vermelho - mais crítica
                        const isWarning = severity === 'warning'; // Amarelo - menos crítica
                        
                        return (
                          <button
                            key={notification.id}
                            onClick={() => handleNotificationClick(notification)}
                            className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${
                              notification.type === 'handoff_requested'
                                ? isError
                                  ? 'border-red-300 bg-red-50 hover:bg-red-100'
                                  : isWarning
                                  ? 'border-yellow-300 bg-yellow-50 hover:bg-yellow-100'
                                  : 'border-red-200 bg-red-50 hover:bg-red-100'
                                : 'border-green-200 bg-green-50 hover:bg-green-100'
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  {notification.type === 'handoff_requested' && (
                                    <span className={`text-lg ${
                                      isError ? 'text-red-600' : isWarning ? 'text-yellow-600' : 'text-red-600'
                                    }`}>
                                      {isError ? '🔴' : isWarning ? '⚠️' : '⚠️'}
                                    </span>
                                  )}
                                  <h3 className="font-semibold text-gray-900">
                                    {notification.type === 'handoff_requested' ? 'Handoff Solicitado' : 'Notificação'}
                                  </h3>
                                </div>
                              <p className="mt-1 text-sm text-gray-600">
                                {notification.metadata?.reason && (
                                  <span>Motivo: {notification.metadata.reason}</span>
                                )}
                                {notification.metadata?.storeName && (
                                  <span className="ml-2">• Loja: {notification.metadata.storeName}</span>
                                )}
                              </p>
                              {notification.metadata?.lastMessagePreview && (
                                <p className="mt-2 text-xs text-gray-500 italic truncate">
                                  "{notification.metadata.lastMessagePreview}"
                                </p>
                              )}
                              <p className="mt-2 text-xs text-gray-400">
                                {new Date(notification.createdAt).toLocaleString('pt-BR')}
                              </p>
                            </div>
                            <svg
                              className="h-5 w-5 text-gray-400 flex-shrink-0 ml-2"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Seção: Notificações Lidas */}
                {readNotifications.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-500 mb-3 uppercase tracking-wide">
                      Lidas ({readNotifications.length})
                    </h3>
                    <div className="space-y-3">
                      {readNotifications.map((notification) => (
                        <button
                          key={notification.id}
                          onClick={() => handleNotificationClick(notification)}
                          className="w-full text-left p-4 rounded-lg border-2 border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors opacity-75"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                {notification.type === 'handoff_requested' && (
                                  <span className="text-gray-400 text-lg">⚠️</span>
                                )}
                                <h3 className="font-medium text-gray-600">
                                  {notification.type === 'handoff_requested' ? 'Handoff Solicitado' : 'Notificação'}
                                </h3>
                                <span className="ml-2 text-xs text-gray-400">✓ Lida</span>
                              </div>
                              <p className="mt-1 text-sm text-gray-500">
                                {notification.metadata?.reason && (
                                  <span>Motivo: {notification.metadata.reason}</span>
                                )}
                                {notification.metadata?.storeName && (
                                  <span className="ml-2">• Loja: {notification.metadata.storeName}</span>
                                )}
                              </p>
                              {notification.metadata?.lastMessagePreview && (
                                <p className="mt-2 text-xs text-gray-400 italic truncate">
                                  "{notification.metadata.lastMessagePreview}"
                                </p>
                              )}
                              <p className="mt-2 text-xs text-gray-400">
                                {new Date(notification.createdAt).toLocaleString('pt-BR')}
                              </p>
                            </div>
                            <svg
                              className="h-5 w-5 text-gray-300 flex-shrink-0 ml-2"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          {unreadNotifications.length > 0 && (
            <div className="p-4 border-t border-gray-200 bg-gray-50">
              <p className="text-xs text-gray-500 text-center">
                Clique em uma notificação para abrir a conversa
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
};
