import { useEffect, useState, useCallback, useRef } from 'react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { useAuth } from '../contexts/AuthContext';
import { useWhatsAppStatus } from '../hooks/useWhatsAppStatus';
import { CheckCircle, WifiOff, RefreshCw, LogOut } from 'lucide-react';

type WhatsAppStatus = {
  status: 'connected' | 'disconnected' | 'connecting' | 'error';
  error?: string;
  qrCode?: string | null;
};

type ConnectionLog = {
  timestamp: Date;
  message: string;
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function SettingsPage() {
  const { token } = useAuth();
  const [whatsappStatus, setWhatsappStatus] = useState<WhatsAppStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );
  const [connectionLogs, setConnectionLogs] = useState<ConnectionLog[]>([]);
  
  // Hook para monitoramento em tempo real via SSE
  const { status: realTimeStatus, hasReceivedInitialStatus: hasRealTimeStatus } = useWhatsAppStatus(token);
  const prevRealTimeStatusRef = useRef<string>('offline');

  // Helper para fazer requisições com autenticação
  const fetchWithAuth = useCallback(async (url: string, options: RequestInit = {}) => {
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string> || {}),
    };
    // Só adiciona Content-Type se houver body (e não foi especificado manualmente)
    if (options.body && (!options.headers || !('Content-Type' in options.headers))) {
      headers['Content-Type'] = 'application/json';
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return fetch(url, { ...options, headers });
  }, [token]);

  const addLog = useCallback((message: string) => {
    setConnectionLogs((prev) => {
      const newLogs = [{ timestamp: new Date(), message }, ...prev].slice(0, 3);
      return newLogs;
    });
  }, []);

  // Buscar status inicial quando o componente montar
  useEffect(() => {
    if (!hasRealTimeStatus) return;

    const fetchWhatsAppStatus = async () => {
      try {
        const res = await fetchWithAuth(`${API_BASE}/api/whatsapp/status`);
        const data = await res.json();
        if (data.success) {
          setWhatsappStatus(data.data);
        }
        setLoading(false);
      } catch (error) {
        console.error('Failed to fetch WhatsApp status:', error);
        setLoading(false);
      }
    };

    fetchWhatsAppStatus();
  }, [hasRealTimeStatus, fetchWithAuth]);

  // Atualizar automaticamente quando o status em tempo real mudar
  useEffect(() => {
    if (!hasRealTimeStatus) return;

    // Quando o status em tempo real mudar para 'online', buscar status atualizado
    if (realTimeStatus === 'online' && prevRealTimeStatusRef.current !== 'online') {
      const fetchStatus = async () => {
        try {
          const res = await fetchWithAuth(`${API_BASE}/api/whatsapp/status`);
          const data = await res.json();
          if (data.success) {
            setWhatsappStatus(data.data);
            if (data.data.status === 'connected') {
              addLog('Conexão estabelecida com sucesso');
              setMessage({ type: 'success', text: '✅ WhatsApp conectado com sucesso!' });
              setTimeout(() => setMessage(null), 5000);
            }
          }
        } catch (error) {
          console.error('Failed to fetch WhatsApp status:', error);
        }
      };
      fetchStatus();
    }
    
    prevRealTimeStatusRef.current = realTimeStatus;
  }, [realTimeStatus, hasRealTimeStatus, fetchWithAuth, addLog]);

  // Polling automático se status for "connecting" ao carregar a página
  // Isso garante que o QR code apareça e a conexão seja detectada automaticamente
  useEffect(() => {
    if (!hasRealTimeStatus) return;

    let pollInterval: NodeJS.Timeout | null = null;
    
    const startPollingIfConnecting = async () => {
      try {
        const statusRes = await fetchWithAuth(`${API_BASE}/api/whatsapp/status`);
        const statusData = await statusRes.json();
        if (statusData.success && statusData.data.status === 'connecting') {
          // Iniciar polling se estiver conectando
          let attempts = 0;
          const maxAttempts = 60; // 60 tentativas = 120 segundos (2s * 60)
          pollInterval = setInterval(async () => {
            attempts++;
            try {
              const res = await fetchWithAuth(`${API_BASE}/api/whatsapp/status`);
              const data = await res.json();
              if (data.success) {
                setWhatsappStatus(data.data);
                
                // Se conectou com sucesso, mostrar mensagem e parar polling
                if (data.data.status === 'connected') {
                  if (pollInterval) clearInterval(pollInterval);
                  setWhatsappStatus(data.data);
                  setMessage({ type: 'success', text: '✅ WhatsApp conectado com sucesso!' });
                  addLog('Conexão estabelecida com sucesso');
                  // Forçar atualização visual adicional após 500ms
                  setTimeout(() => {
                    fetchWithAuth(`${API_BASE}/api/whatsapp/status`)
                      .then((res) => res.json())
                      .then((statusData) => {
                        if (statusData.success) {
                          setWhatsappStatus(statusData.data);
                        }
                      })
                      .catch(console.error);
                  }, 500);
                }
                // Parar polling se QR apareceu, conectou, erro ou timeout
                else if (
                  data.data.qrCode ||
                  data.data.status === 'error' ||
                  data.data.status === 'disconnected' ||
                  attempts >= maxAttempts
                ) {
                  if (pollInterval) clearInterval(pollInterval);
                }
              }
            } catch (error) {
              console.error('Erro ao verificar status:', error);
              if (attempts >= maxAttempts && pollInterval) {
                clearInterval(pollInterval);
              }
            }
          }, 2000);
        }
      } catch (error) {
        console.error('Erro ao verificar status inicial:', error);
      }
    };
    
    // Aguardar um pouco antes de verificar (para dar tempo do status inicial carregar)
    const timeoutId = setTimeout(startPollingIfConnecting, 2000);

    return () => {
      if (pollInterval) clearInterval(pollInterval);
      clearTimeout(timeoutId);
    };
  }, [hasRealTimeStatus, fetchWithAuth, addLog]);

  const handleConnect = async () => {
    try {
      setMessage({ type: 'success', text: 'Iniciando conexão...' });
      const res = await fetchWithAuth(`${API_BASE}/api/whatsapp/connect`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: 'Conexão iniciada. Aguarde o QR code...' });
        addLog('Iniciando conexão...');
        
        // Polling temporário para buscar QR code quando status for "connecting"
        let attempts = 0;
        const maxAttempts = 30; // 30 tentativas = 60 segundos (2s * 30)
        const pollInterval = setInterval(async () => {
          attempts++;
          try {
            const statusRes = await fetchWithAuth(`${API_BASE}/api/whatsapp/status`);
            const statusData = await statusRes.json();
            if (statusData.success) {
              setWhatsappStatus(statusData.data);
              
              // Parar polling se:
              // 1. QR code apareceu
              // 2. Conectou com sucesso
              // 3. Erro ocorreu
              // 4. Limite de tentativas atingido
              if (
                statusData.data.qrCode ||
                statusData.data.status === 'connected' ||
                statusData.data.status === 'error' ||
                attempts >= maxAttempts
              ) {
                clearInterval(pollInterval);
                if (statusData.data.status === 'connected') {
                  setMessage({ type: 'success', text: '✅ WhatsApp conectado com sucesso!' });
                  addLog('Conexão estabelecida com sucesso');
                  setTimeout(() => {
                    fetchWithAuth(`${API_BASE}/api/whatsapp/status`)
                      .then((res) => res.json())
                      .then((data) => {
                        if (data.success) {
                          setWhatsappStatus(data.data);
                        }
                      })
                      .catch(console.error);
                  }, 500);
                } else if (statusData.data.qrCode) {
                  setMessage({ type: 'success', text: 'QR code disponível. Escaneie com seu WhatsApp.' });
                  addLog('QR code gerado');
                } else if (attempts >= maxAttempts) {
                  setMessage({ type: 'error', text: 'Timeout aguardando QR code. Tente novamente.' });
                }
              }
            }
          } catch (error) {
            console.error('Erro ao verificar status:', error);
            if (attempts >= maxAttempts) {
              clearInterval(pollInterval);
            }
          }
        }, 2000); // Verificar a cada 2 segundos
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Falha ao conectar WhatsApp' });
      addLog('Erro ao conectar');
    }
  };

  const handleDisconnect = async () => {
    try {
      const res = await fetchWithAuth(`${API_BASE}/api/whatsapp/disconnect`, {
        method: 'POST',
        headers: {
          // Não incluir Content-Type para requisições sem body
        },
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: data.message || 'WhatsApp desconectado e sessão limpa. Próxima conexão exigirá novo QR code.' });
        addLog('Sistema desconectado');
        // Atualizar status após desconectar
        const statusRes = await fetchWithAuth(`${API_BASE}/api/whatsapp/status`);
        const statusData = await statusRes.json();
        if (statusData.success) {
          setWhatsappStatus(statusData.data);
        }
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Falha ao desconectar WhatsApp' });
      addLog('Erro ao desconectar');
    }
  };

  const handleReconnect = async () => {
    try {
      const res = await fetchWithAuth(`${API_BASE}/api/whatsapp/reconnect`, {
        method: 'POST',
        headers: {
          // Não incluir Content-Type para requisições sem body
        },
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: 'Reconexão iniciada. Aguarde o QR code...' });
        addLog('Reconexão iniciada');
        
        // Polling temporário para buscar QR code quando status for "connecting"
        let attempts = 0;
        const maxAttempts = 30; // 30 tentativas = 60 segundos (2s * 30)
        const pollInterval = setInterval(async () => {
          attempts++;
          try {
            const statusRes = await fetchWithAuth(`${API_BASE}/api/whatsapp/status`);
            const statusData = await statusRes.json();
            if (statusData.success) {
              setWhatsappStatus(statusData.data);
              
              // Parar polling se:
              // 1. QR code apareceu
              // 2. Conectou com sucesso
              // 3. Erro ocorreu
              // 4. Limite de tentativas atingido
              if (
                statusData.data.qrCode ||
                statusData.data.status === 'connected' ||
                statusData.data.status === 'error' ||
                attempts >= maxAttempts
              ) {
                clearInterval(pollInterval);
                if (statusData.data.status === 'connected') {
                  setMessage({ type: 'success', text: '✅ WhatsApp conectado com sucesso!' });
                  addLog('Conexão estabelecida com sucesso');
                  setTimeout(() => {
                    fetchWithAuth(`${API_BASE}/api/whatsapp/status`)
                      .then((res) => res.json())
                      .then((data) => {
                        if (data.success) {
                          setWhatsappStatus(data.data);
                        }
                      })
                      .catch(console.error);
                  }, 500);
                } else if (statusData.data.qrCode) {
                  setMessage({ type: 'success', text: 'QR code disponível. Escaneie com seu WhatsApp.' });
                  addLog('QR code gerado');
                } else if (attempts >= maxAttempts) {
                  setMessage({ type: 'error', text: 'Timeout aguardando QR code. Tente novamente.' });
                }
              }
            }
          } catch (error) {
            console.error('Erro ao verificar status:', error);
            if (attempts >= maxAttempts) {
              clearInterval(pollInterval);
            }
          }
        }, 2000); // Verificar a cada 2 segundos
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Falha ao reconectar WhatsApp' });
      addLog('Erro ao reconectar');
    }
  };

  const formatLogTime = (date: Date): string => {
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="flex justify-center items-center h-64">
            <div className="text-gray-500">Loading...</div>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="max-w-2xl mx-auto mt-10 px-4">
          {/* Card Principal de Status */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            {/* Header do Card */}
            <div className="px-8 py-6 border-b border-slate-100">
              <h2 className="text-2xl font-bold text-slate-900">Status da Conexão</h2>
              <p className="text-sm text-slate-500 mt-1">Gerencie a integração com o WhatsApp Business</p>
            </div>

            {/* Corpo do Card */}
            <div className="px-8 py-12">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <div className="w-16 h-16 border-4 border-green-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                  <p className="text-sm text-slate-500">Carregando status...</p>
                </div>
              ) : whatsappStatus?.status === 'connected' ? (
                <div className="flex flex-col items-center justify-center">
                  {/* Indicador de Status Conectado */}
                  <div className="relative mb-6">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-24 h-24 bg-green-100 rounded-full animate-ping opacity-75"></div>
                    </div>
                    <div className="relative">
                      <CheckCircle className="w-24 h-24 text-green-600" />
                    </div>
                  </div>
                  <h3 className="text-xl font-semibold text-slate-900 mb-2">Sistema Online e Operante</h3>
                  <p className="text-sm text-slate-500">WhatsApp Business conectado e funcionando normalmente</p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center">
                  {/* Indicador de Status Desconectado */}
                  <div className="mb-6">
                    <WifiOff className="w-24 h-24 text-red-600" />
                  </div>
                  <h3 className="text-xl font-semibold text-slate-900 mb-2">Desconectado</h3>
                  <p className="text-sm text-slate-500 mb-6">O sistema não está conectado ao WhatsApp Business</p>

                  {/* QR Code Area */}
                  {whatsappStatus?.qrCode && (
                    <div className="w-full max-w-sm bg-white border-2 border-green-200 rounded-xl p-6 mb-6">
                      <p className="text-sm font-medium text-slate-900 mb-4 text-center">
                        Escaneie este QR code com o WhatsApp:
                      </p>
                      <div className="flex justify-center mb-4">
                        <img
                          src={whatsappStatus.qrCode}
                          alt="QR Code WhatsApp"
                          className="border border-slate-200 rounded-lg"
                        />
                      </div>
                      <p className="text-xs text-slate-500 text-center">
                        WhatsApp → Configurações → Aparelhos conectados → Conectar um aparelho
                      </p>
                    </div>
                  )}

                  {whatsappStatus?.error && (
                    <div className="w-full max-w-sm bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                      <p className="text-sm text-red-800">{whatsappStatus.error}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Mensagem de Feedback */}
              {message && (
                <div
                  className={`mt-6 p-4 rounded-lg ${
                    message.type === 'success' 
                      ? 'bg-green-50 text-green-800 border border-green-200' 
                      : 'bg-red-50 text-red-800 border border-red-200'
                  }`}
                >
                  <p className="text-sm font-medium">{message.text}</p>
                </div>
              )}
            </div>

            {/* Painel de Ações (Rodapé) */}
            <div className="px-8 py-6 bg-slate-50 border-t border-slate-200">
              <div className="flex items-center gap-3">
                {whatsappStatus?.status === 'connected' ? (
                  <>
                    <button
                      onClick={handleReconnect}
                      className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors shadow-sm hover:shadow-md"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Reconectar
                    </button>
                    <button
                      onClick={handleDisconnect}
                      className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-white border border-red-200 text-red-600 hover:bg-red-50 font-medium rounded-lg transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      Desconectar
                    </button>
                  </>
                ) : (
                  <button
                    onClick={handleReconnect}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors shadow-sm hover:shadow-md"
                  >
                    <RefreshCw className="w-4 h-4" />
                    {whatsappStatus?.status === 'connecting' ? 'Atualizar QR Code' : 'Conectar WhatsApp'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Logs Recentes */}
          {connectionLogs.length > 0 && (
            <div className="mt-6 bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h3 className="text-sm font-semibold text-slate-900 mb-4">Logs Recentes</h3>
              <div className="space-y-2">
                {connectionLogs.map((log, index) => (
                  <div key={index} className="flex items-start gap-3 font-mono text-xs text-slate-500">
                    <span className="text-slate-400">{formatLogTime(log.timestamp)}</span>
                    <span className="text-slate-600">{log.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}

