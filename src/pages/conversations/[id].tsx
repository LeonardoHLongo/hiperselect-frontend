import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import { Paperclip, Smile, Send, ChevronDown, ChevronUp, Tag, Sparkles, Loader2 } from 'lucide-react';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import { ProtectedRoute } from '../../components/ProtectedRoute';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';

type SenderInfo = {
  phoneNumber: string;
  jid: string;
  pushName?: string;
  profilePictureUrl?: string;
};

type Conversation = {
  conversationId: string;
  sender: SenderInfo;
  lastMessageAt: number;
  messageCount: number;
  createdAt: number;
  aiEnabled?: boolean;
  aiDisabledBy?: string | null;
  aiDisabledReason?: string | null;
};

type MediaInfo = {
  type: 'image' | 'audio' | 'video' | 'document';
  mimetype?: string;
  caption?: string;
  url?: string;
  mediaId?: string;
};

type Message = {
  messageId: string;
  conversationId: string;
  text: string | null;
  timestamp: number;
  sender: SenderInfo;
  media?: MediaInfo;
  messageType: 'text' | 'image' | 'audio' | 'video' | 'document' | 'other';
  agent_id?: string | null;
  agent_name?: string | null;
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Componente para carregar imagem com autenticação (thumbnail clicável)
function AuthenticatedImage({ 
  src, 
  alt, 
  className,
  conversationId,
  messageId,
  token 
}: { 
  src: string; 
  alt: string; 
  className?: string;
  conversationId: string;
  messageId: string;
  token: string | null;
}) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (!token) {
      setError(true);
      setLoading(false);
      return;
    }

    const loadImage = async () => {
      try {
        const mediaUrl = `${API_BASE}/api/v1/conversations/${conversationId}/messages/${messageId}/media`;
        const response = await fetch(mediaUrl, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to load image: ${response.status}`);
        }

        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        setImageSrc(blobUrl);
        setLoading(false);
      } catch (err) {
        console.error('Error loading image:', err);
        setError(true);
        setLoading(false);
      }
    };

    loadImage();

    // Cleanup: revogar blob URL quando componente desmontar ou mudar
    return () => {
      // A limpeza será feita quando imageSrc mudar ou componente desmontar
    };
  }, [conversationId, messageId, token]);

  // Cleanup separado para revogar blob URL quando imageSrc mudar ou componente desmontar
  useEffect(() => {
    return () => {
      if (imageSrc) {
        URL.revokeObjectURL(imageSrc);
      }
    };
  }, [imageSrc]);

  if (error) {
    return (
      <div className="text-sm text-zinc-500 italic p-3 bg-zinc-100 rounded-xl">
        Erro ao carregar imagem
      </div>
    );
  }

  if (loading) {
    return (
      <div className="w-48 h-48 bg-zinc-100 rounded-xl flex items-center justify-center">
        <span className="text-sm text-zinc-500">Carregando...</span>
      </div>
    );
  }

  return (
    <>
      {/* Thumbnail clicável */}
      <div 
        className="w-48 h-48 rounded-xl overflow-hidden cursor-pointer border-2 border-zinc-200 hover:border-green-500 transition-all shadow-sm hover:shadow-lg"
        onClick={() => setShowModal(true)}
      >
        <img
          src={imageSrc || ''}
          alt={alt}
          className="w-full h-full object-cover"
          onError={() => setError(true)}
        />
      </div>

      {/* Modal para exibir imagem completa */}
      {showModal && imageSrc && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setShowModal(false)}
        >
          <div className="relative max-w-5xl max-h-full">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 text-white bg-black/50 hover:bg-black/70 rounded-full p-2.5 transition-all z-10 shadow-lg"
              aria-label="Fechar"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <img
              src={imageSrc}
              alt={alt}
              className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </>
  );
}

// Componente para carregar áudio com autenticação
function AuthenticatedAudio({ 
  conversationId,
  messageId,
  token,
  className 
}: { 
  conversationId: string;
  messageId: string;
  token: string | null;
  className?: string;
}) {
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!token) {
      setError(true);
      setLoading(false);
      return;
    }

    const loadAudio = async () => {
      try {
        const mediaUrl = `${API_BASE}/api/v1/conversations/${conversationId}/messages/${messageId}/media`;
        const response = await fetch(mediaUrl, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to load audio: ${response.status}`);
        }

        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        setAudioSrc(blobUrl);
        setLoading(false);
      } catch (err) {
        console.error('Error loading audio:', err);
        setError(true);
        setLoading(false);
      }
    };

    loadAudio();

    // Cleanup: revogar blob URL quando componente desmontar ou mudar
    return () => {
      // A limpeza será feita quando audioSrc mudar ou componente desmontar
    };
  }, [conversationId, messageId, token]);

  // Cleanup separado para revogar blob URL quando audioSrc mudar ou componente desmontar
  useEffect(() => {
    return () => {
      if (audioSrc) {
        URL.revokeObjectURL(audioSrc);
      }
    };
  }, [audioSrc]);

  if (error) {
    return (
      <div className="text-xs text-gray-500 italic p-2">
        Erro ao carregar áudio
      </div>
    );
  }

  if (loading) {
    return (
      <div className="text-xs text-gray-500 italic p-2">
        Carregando áudio...
      </div>
    );
  }

  return (
    <audio
      controls
      className={className}
      src={audioSrc || ''}
      onError={() => setError(true)}
    >
      Seu navegador não suporta o elemento de áudio.
    </audio>
  );
}

// Componente para carregar vídeo com autenticação
function AuthenticatedVideo({ 
  conversationId,
  messageId,
  token,
  className,
  caption 
}: { 
  conversationId: string;
  messageId: string;
  token: string | null;
  className?: string;
  caption?: string;
}) {
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!token) {
      setError(true);
      setLoading(false);
      return;
    }

    const loadVideo = async () => {
      try {
        const mediaUrl = `${API_BASE}/api/v1/conversations/${conversationId}/messages/${messageId}/media`;
        const response = await fetch(mediaUrl, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to load video: ${response.status}`);
        }

        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        setVideoSrc(blobUrl);
        setLoading(false);
      } catch (err) {
        console.error('Error loading video:', err);
        setError(true);
        setLoading(false);
      }
    };

    loadVideo();

    // Cleanup: revogar blob URL quando componente desmontar ou mudar
    return () => {
      // A limpeza será feita quando videoSrc mudar ou componente desmontar
    };
  }, [conversationId, messageId, token]);

  // Cleanup separado para revogar blob URL quando videoSrc mudar ou componente desmontar
  useEffect(() => {
    return () => {
      if (videoSrc) {
        URL.revokeObjectURL(videoSrc);
      }
    };
  }, [videoSrc]);

  if (error) {
    return (
      <div className="text-xs text-gray-500 italic p-2">
        Erro ao carregar vídeo
      </div>
    );
  }

  if (loading) {
    return (
      <div className="text-xs text-gray-500 italic p-2">
        Carregando vídeo...
      </div>
    );
  }

  return (
    <video
      controls
      className={className}
      src={videoSrc || ''}
      onError={() => setError(true)}
    >
      Seu navegador não suporta o elemento de vídeo.
    </video>
  );
}

export default function ConversationDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const authContext = useAuth();
  const { token } = authContext;
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [fixingGrammar, setFixingGrammar] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(true);
  const [togglingAI, setTogglingAI] = useState(false);
  const { notifications, markConversationAsRead } = useNotifications();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showContextSections, setShowContextSections] = useState({
    tags: true
  });
  const [agentColors, setAgentColors] = useState<Record<string, string>>({}); // Mapa de agent_id -> color

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString();
  };

  const handleFixGrammar = async () => {
    if (!messageText.trim() || fixingGrammar) {
      return;
    }

    setFixingGrammar(true);
    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${API_BASE}/api/v1/ai/fix-grammar`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ text: messageText }),
      });

      const data = await response.json();
      
      if (data.success && data.data?.corrected) {
        // Remover aspas duplas do início e fim do texto, se existirem
        let correctedText = data.data.corrected.trim();
        if (correctedText.startsWith('"') && correctedText.endsWith('"')) {
          correctedText = correctedText.slice(1, -1);
        }
        // Remover aspas simples do início e fim, se existirem
        if (correctedText.startsWith("'") && correctedText.endsWith("'")) {
          correctedText = correctedText.slice(1, -1);
        }
        
        setMessageText(correctedText);
        console.log('[Frontend] ✅ Gramática corrigida:', {
          original: data.data.original,
          corrected: correctedText,
        });
      } else {
        console.error('[Frontend] ❌ Erro ao corrigir gramática:', data);
        alert(`Erro ao corrigir gramática: ${data.message || 'Erro desconhecido'}`);
      }
    } catch (error: any) {
      console.error('[Frontend] ❌ Erro ao corrigir gramática:', error);
      alert(`Erro ao corrigir gramática: ${error?.message || 'Erro de conexão'}`);
    } finally {
      setFixingGrammar(false);
    }
  };

  const fetchData = async () => {
    if (!id || typeof id !== 'string') return;

    try {
      const headers: HeadersInit = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const [convRes, messagesRes] = await Promise.all([
        fetch(`${API_BASE}/api/v1/conversations/${id}`, { headers }),
        fetch(`${API_BASE}/api/v1/conversations/${id}/messages`, { headers }),
      ]);

      const convData = await convRes.json();
      const messagesData = await messagesRes.json();

      if (convData.success) {
        setConversation(convData.data);
        // Atualizar estado local do toggle de IA
        setAiEnabled(convData.data.aiEnabled !== false); // Default true se não definido
      }
      if (messagesData.success) {
        setMessages(messagesData.data || []);
        
        // Buscar cores dos agentes únicos que enviaram mensagens
        const uniqueAgentIds = new Set<string>();
        messagesData.data?.forEach((msg: Message) => {
          if (msg.agent_id) {
            uniqueAgentIds.add(msg.agent_id);
          }
        });
        
        // Buscar cores dos agentes
        if (uniqueAgentIds.size > 0 && token) {
          try {
            const teamRes = await fetch(`${API_BASE}/api/v1/team`, { headers });
            const teamData = await teamRes.json();
            
            if (teamData.success && teamData.data) {
              const colorsMap: Record<string, string> = {};
              teamData.data.forEach((member: { id: string; color?: string }) => {
                if (uniqueAgentIds.has(member.id)) {
                  colorsMap[member.id] = member.color || '#3B82F6';
                }
              });
              setAgentColors(colorsMap);
            }
          } catch (error) {
            console.error('Failed to fetch agent colors:', error);
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch conversation:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!id || typeof id !== 'string') return;

    fetchData();
    const interval = setInterval(fetchData, 5000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, token]);

  // Marcar notificações como lidas ao abrir a conversa
  useEffect(() => {
    if (id && typeof id === 'string' && conversation) {
      markConversationAsRead(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, conversation?.conversationId]);

  const handleToggleAI = async (enabled: boolean) => {
    if (!id || typeof id !== 'string' || togglingAI) return;

    setTogglingAI(true);
    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const endpoint = enabled 
        ? `${API_BASE}/api/v1/conversations/${id}/ai/enable`
        : `${API_BASE}/api/v1/conversations/${id}/ai/disable`;

      const response = await fetch(endpoint, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({}),
      });

      const data = await response.json();

      if (data.success) {
        setAiEnabled(enabled);
        setConversation(data.data);
        // Recarregar dados
        fetchData();
      } else {
        alert(`Erro ao ${enabled ? 'habilitar' : 'desabilitar'} IA: ${data.message}`);
      }
    } catch (error) {
      console.error('Failed to update AI status:', error);
      alert(`Erro ao ${enabled ? 'habilitar' : 'desabilitar'} IA. Tente novamente.`);
    } finally {
      setTogglingAI(false);
    }
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() || !id || typeof id !== 'string' || sending) {
      return;
    }

    setSending(true);
    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      // Obter informações do usuário logado para rastreamento
      const user = authContext?.user;
      console.log('[Frontend] 👤 User info from auth context:', {
        userId: user?.id,
        userName: user?.name,
        userEmail: user?.email,
        userRole: user?.role,
      });
      
      const requestBody: { text: string; agent_id?: string; agent_name?: string } = {
        text: messageText.trim(),
      };

      if (user?.id) {
        requestBody.agent_id = user.id;
        console.log('[Frontend] ✅ Adicionando agent_id ao request:', user.id);
      } else {
        console.log('[Frontend] ⚠️ User ID não encontrado no auth context');
      }
      
      if (user?.name) {
        requestBody.agent_name = user.name;
        console.log('[Frontend] ✅ Adicionando agent_name ao request:', user.name);
      } else {
        console.log('[Frontend] ⚠️ User name não encontrado no auth context');
      }

      console.log('[Frontend] 📤 Request body completo:', JSON.stringify(requestBody, null, 2));

      const response = await fetch(`${API_BASE}/api/v1/conversations/${id}/messages`, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (data.success) {
        setMessageText('');
        // Marcar notificações como lidas ao responder
        if (id && typeof id === 'string') {
          markConversationAsRead(id);
        }
        // Recarregar mensagens após enviar
        setTimeout(() => {
          fetchData();
        }, 500);
      } else {
        alert(`Erro ao enviar mensagem: ${data.message}`);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      alert('Erro ao enviar mensagem. Verifique se o WhatsApp está conectado.');
    } finally {
      setSending(false);
    }
  };

  // Scroll para a última mensagem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Determinar se a mensagem é do sistema (enviada por nós)
  const isFromSystem = (message: Message): boolean => {
    return message.sender.phoneNumber === 'system';
  };

  if (loading) {
    return (
      <ProtectedRoute>
      <DashboardLayout>
          <div className="flex justify-center items-center h-[calc(100vh-64px)]">
            <div className="text-slate-500">Carregando...</div>
        </div>
      </DashboardLayout>
      </ProtectedRoute>
    );
  }

  if (!conversation) {
    return (
      <ProtectedRoute>
      <DashboardLayout>
          <div className="flex justify-center items-center h-[calc(100vh-64px)]">
            <div className="text-center text-slate-500">Conversa não encontrada</div>
        </div>
      </DashboardLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
    <DashboardLayout>
        <div className="h-[calc(100vh-64px)] flex overflow-hidden">
          {/* Área Principal - Chat */}
          <div className="flex-1 flex flex-col bg-white">
            {/* Header Sticky */}
            <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-4">
          <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
              {conversation.sender.profilePictureUrl ? (
                <img
                  src={conversation.sender.profilePictureUrl}
                  alt={conversation.sender.pushName || conversation.sender.phoneNumber}
                      className="h-10 w-10 rounded-full object-cover"
                />
              ) : (
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
                      <span className="text-white text-sm font-bold">
                    {(conversation.sender.pushName || conversation.sender.phoneNumber)[0].toUpperCase()}
                  </span>
                </div>
              )}
              <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-semibold text-slate-900">
                  {conversation.sender.pushName || conversation.sender.phoneNumber}
                </h2>
                      <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    </div>
                    <p className="text-xs text-slate-500">{conversation.sender.phoneNumber}</p>
              </div>
            </div>
            
            {/* Toggle de IA */}
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium ${aiEnabled ? 'text-green-600' : 'text-red-600'}`}>
                    IA {aiEnabled ? 'Ligada' : 'Desligada'}
              </span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={aiEnabled}
                  onChange={(e) => handleToggleAI(e.target.checked)}
                  disabled={togglingAI}
                  className="sr-only peer"
                />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-green-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-600"></div>
              </label>
          </div>
        </div>

          {/* Banners de Alerta */}
          {(!aiEnabled || notifications.some(n => n.type === 'handoff_requested' && !n.isRead)) && (
            <div className="mt-3 space-y-2">
        {!aiEnabled && (
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 rounded">
                  <p className="text-xs text-yellow-700">
                  <span className="font-medium">IA desativada</span> — aguardando atendente humano
                  {conversation.aiDisabledReason && (
                    <span className="ml-1">(motivo: {conversation.aiDisabledReason})</span>
                  )}
                </p>
          </div>
        )}

        {notifications.some(n => n.type === 'handoff_requested' && !n.isRead) && (() => {
          const handoffNotification = notifications.find(n => n.type === 'handoff_requested' && !n.isRead);
          const severity = (handoffNotification?.metadata?.severity as 'warning' | 'error') || 'warning';
          const isError = severity === 'error';
          
          return (
                  <div className={`border-l-4 p-3 rounded ${
                    isError ? 'bg-red-50 border-red-400' : 'bg-yellow-50 border-yellow-400'
            }`}>
                    <p className={`text-xs ${
                      isError ? 'text-red-700' : 'text-yellow-700'
                  }`}>
                    <span className="font-medium">Handoff solicitado</span> — cliente pediu atendimento humano
                    {handoffNotification?.metadata?.reason && (
                      <span className="ml-1">(motivo: {handoffNotification.metadata.reason})</span>
                    )}
                  </p>
            </div>
          );
        })()}
            </div>
          )}
        </div>

          {/* Messages Area - Scroll */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50" style={{ backgroundImage: 'radial-gradient(circle, #e2e8f0 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
          {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center text-zinc-500">
                  <p className="text-lg font-medium">Nenhuma mensagem ainda</p>
                  <p className="text-sm mt-2">Inicie a conversa enviando uma mensagem</p>
                </div>
              </div>
            ) : (
              messages.map((message) => {
                const fromSystem = isFromSystem(message);
                const isFromAgent = !!(message.agent_id && message.agent_name);
                // Buscar cor do agente (ou usar padrão)
                const agentColor = message.agent_id ? (agentColors[message.agent_id] || '#3B82F6') : '#10B981';
                
                return (
                  <div
                    key={message.messageId}
                    className={`flex ${fromSystem ? 'justify-end' : 'justify-start'} mb-4`}
                  >
                    <div className={`flex gap-3 ${fromSystem ? 'flex-row-reverse' : 'flex-row'} max-w-[85%] sm:max-w-[75%] lg:max-w-[600px]`}>
                      {/* Avatar (apenas para mensagens do cliente) */}
                      {!fromSystem && (
                        <div className="flex-shrink-0">
                    {message.sender.profilePictureUrl ? (
                      <img
                        src={message.sender.profilePictureUrl}
                        alt={message.sender.pushName || message.sender.phoneNumber}
                        className="h-8 w-8 rounded-full object-cover"
                      />
                    ) : (
                            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
                              <span className="text-white text-xs font-bold">
                          {(message.sender.pushName || message.sender.phoneNumber)[0].toUpperCase()}
                        </span>
                      </div>
                    )}
                        </div>
                      )}
                      
                      {/* Message Bubble */}
                      <div className={`flex flex-col ${fromSystem ? 'items-end' : 'items-start'} min-w-0 flex-1`}>
                        <div className="relative w-full">
                          {/* Tail (ponta) da bolha */}
                          {fromSystem ? (
                            <div 
                              className="absolute -right-2 top-4 w-0 h-0 border-t-[6px] border-t-transparent border-l-[6px]"
                              style={{
                                borderLeftColor: isFromAgent ? agentColor : '#10B981'
                              }}
                            ></div>
                          ) : (
                            <div className="absolute -left-2 top-4 w-0 h-0 border-t-[6px] border-t-transparent border-r-[6px] border-r-slate-200">
                              <div className="absolute -right-[1px] top-0 w-0 h-0 border-t-[5px] border-t-transparent border-r-[5px] border-r-white"></div>
                      </div>
                          )}
                          
                          <div
                            className={`
                              p-3 shadow-sm relative break-words text-white rounded-2xl
                              ${fromSystem 
                                ? ''
                                : 'bg-white text-slate-900 border border-slate-200'
                              }
                            `}
                            style={fromSystem ? {
                              backgroundColor: isFromAgent ? agentColor : '#10B981'
                            } : {}}
                          >
                            {/* Indicador de agente */}
                            {isFromAgent && (
                              <div className="text-xs font-medium mb-1 opacity-90">
                                {message.agent_name} Disse:
                              </div>
                            )}
                            {/* Media */}
                      {message.media && (
                              <div className="mb-2 last:mb-0">
                          {message.media.type === 'image' && (
                                  <div className="rounded-xl overflow-hidden mb-2">
                              {id && typeof id === 'string' && (
                                <AuthenticatedImage
                                  src=""
                                  alt={message.media.caption || 'Imagem recebida'}
                                  className=""
                                  conversationId={id}
                                  messageId={message.messageId}
                                  token={token}
                                />
                              )}
                                    {message.media.caption && (
                                      <p className={`text-sm mt-2 ${fromSystem ? 'text-white/90' : 'text-slate-700'}`}>
                                        {message.media.caption}
                                      </p>
                                    )}
                            </div>
                          )}
                          
                          {message.media.type === 'audio' && (
                                  <div className="mb-2">
                              {id && typeof id === 'string' && (
                                <AuthenticatedAudio
                                  conversationId={id}
                                  messageId={message.messageId}
                                  token={token}
                                  className="w-full"
                                />
                              )}
                            </div>
                          )}
                          
                          {message.media.type === 'video' && (
                                  <div className="rounded-xl overflow-hidden mb-2">
                              {id && typeof id === 'string' && (
                                <AuthenticatedVideo
                                  conversationId={id}
                                  messageId={message.messageId}
                                  token={token}
                                        className="max-w-full h-auto rounded-xl"
                                  caption={message.media.caption}
                                />
                              )}
                                    {message.media.caption && (
                                      <p className={`text-sm mt-2 ${fromSystem ? 'text-white/90' : 'text-slate-700'}`}>
                                        {message.media.caption}
                                      </p>
                                    )}
                            </div>
                          )}
                          
                          {message.media.type === 'document' && (
                                  <div className={`p-3 rounded-lg ${fromSystem ? 'bg-green-700' : 'bg-slate-100'}`}>
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="text-lg">📄</span>
                                      <span className={`text-sm font-medium ${fromSystem ? 'text-white' : 'text-slate-900'}`}>
                                        Documento
                                      </span>
                              </div>
                              {message.media.caption && (
                                      <p className={`text-xs ${fromSystem ? 'text-white/80' : 'text-slate-600'}`}>
                                        {message.media.caption}
                                      </p>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                      
                            {/* Text */}
                      {message.text && (
                              <p className={`text-sm whitespace-pre-wrap break-words ${fromSystem ? 'text-white' : 'text-slate-900'}`}>
                                {message.text}
                              </p>
                      )}
                      
                      {!message.text && !message.media && (
                              <p className={`text-xs italic ${fromSystem ? 'text-white/70' : 'text-slate-400'}`}>
                                (Mensagem sem conteúdo)
                              </p>
                      )}
                    </div>
                  </div>
                        
                        {/* Timestamp */}
                        <span className={`text-xs mt-1.5 px-1 ${fromSystem ? 'text-slate-500' : 'text-slate-400'}`}>
                          {formatDate(message.timestamp)}
                        </span>
                </div>
            </div>
                  </div>
                );
              })
          )}
            <div ref={messagesEndRef} />
        </div>

          {/* Input Area - Fixado no rodapé */}
          <div className="border-t border-slate-200 p-4 bg-white">
            <div className="flex items-end gap-2">
              <button className="p-2 text-slate-400 hover:text-slate-600 transition-colors" title="Anexar arquivo">
                <Paperclip className="w-5 h-5" />
              </button>
              <div className="flex-1 relative">
            <input
              type="text"
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Digite sua mensagem..."
                  className="w-full px-4 py-2.5 pr-24 border border-slate-300 rounded-full focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all text-sm"
              disabled={sending || fixingGrammar}
            />
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center gap-2 bg-white pl-2">
                  <button 
                    onClick={handleFixGrammar}
                    disabled={!messageText.trim() || fixingGrammar}
                    className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 disabled:text-slate-300 disabled:cursor-not-allowed transition-colors rounded-full" 
                    title="Corrigir Gramática (IA)"
                  >
                    {fixingGrammar ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4" />
                    )}
                  </button>
                  <button className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors rounded-full" title="Emoji">
                    <Smile className="w-4 h-4" />
                  </button>
                </div>
              </div>
            <button
              onClick={handleSendMessage}
              disabled={!messageText.trim() || sending}
                className="p-2.5 bg-green-600 text-white rounded-full hover:bg-green-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md disabled:shadow-none"
                title="Enviar mensagem"
            >
                <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

        {/* Painel de Contexto - Direita */}
        <div className="w-80 border-l border-slate-200 bg-white flex flex-col overflow-y-auto">
          {/* Header do Painel */}
          <div className="p-6 border-b border-slate-200">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Informações do Cliente</h3>
            
            {/* Avatar Grande */}
            <div className="flex flex-col items-center mb-4">
              {conversation.sender.profilePictureUrl ? (
                <img
                  src={conversation.sender.profilePictureUrl}
                  alt={conversation.sender.pushName || conversation.sender.phoneNumber}
                  className="h-20 w-20 rounded-full object-cover mb-3"
                />
              ) : (
                <div className="h-20 w-20 rounded-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center mb-3">
                  <span className="text-white text-2xl font-bold">
                    {(conversation.sender.pushName || conversation.sender.phoneNumber)[0].toUpperCase()}
                  </span>
                </div>
              )}
              <p className="text-base font-semibold text-slate-900">
                {conversation.sender.pushName || conversation.sender.phoneNumber}
              </p>
            </div>
            
            {/* Informações de Contato */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <span className="font-medium">Telefone:</span>
                <span>{conversation.sender.phoneNumber}</span>
              </div>
            </div>
          </div>

          {/* Seções Colapsáveis */}
          <div className="flex-1 p-6 space-y-4">
            {/* Tags */}
            <div className="border border-slate-200 rounded-lg">
              <button
                onClick={() => setShowContextSections({ ...showContextSections, tags: !showContextSections.tags })}
                className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Tag className="w-4 h-4 text-slate-500" />
                  <span className="text-sm font-semibold text-slate-900">Tags</span>
                </div>
                {showContextSections.tags ? (
                  <ChevronUp className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                )}
              </button>
              {showContextSections.tags && (
                <div className="p-4 pt-0 border-t border-slate-200">
                  <div className="flex flex-wrap gap-2">
                    <span className="px-2.5 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">
                      Cliente VIP
                    </span>
                    <span className="px-2.5 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">
                      Ativo
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
    </ProtectedRoute>
  );
}

