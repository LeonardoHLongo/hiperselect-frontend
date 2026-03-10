import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Search, Filter, MoreVertical, CheckCircle2 } from 'lucide-react';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import { ProtectedRoute } from '../../components/ProtectedRoute';
import { useAuth } from '../../contexts/AuthContext';

type SenderInfo = {
  phoneNumber: string;
  jid: string;
  pushName?: string;
  profilePictureUrl?: string;
};

type LastMessage = {
  id: string;
  text?: string;
  type: 'text' | 'image' | 'audio' | 'video' | 'document';
  fromMe: boolean;
  timestamp: number;
};

type Conversation = {
  conversationId: string;
  sender: SenderInfo;
  lastMessage: LastMessage | null;
  unreadCount: number;
  lastMessageAt: number;
  messageCount: number;
  createdAt: number;
  aiEnabled?: boolean;
  state?: 'open' | 'waiting' | 'waiting_human' | 'archived';
  waitingHumanAt?: number | null;
  agentNames?: string[];
  agentColors?: Record<string, string>; // Mapa de nome do agente -> cor (hex)
};

type Notification = {
  id: string;
  type: string;
  conversationId: string;
  isRead: boolean;
  metadata?: {
    reason?: string;
    severity?: 'warning' | 'error'; // Severidade visual: warning (amarelo) ou error (vermelho)
  };
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Componente para exibir timer de espera
function WaitingTimer({ waitingSince }: { waitingSince: number }) {
  const [elapsed, setElapsed] = useState<string>('');

  useEffect(() => {
    const updateTimer = () => {
      const now = Date.now();
      const diffMs = now - waitingSince;
      const diffMinutes = Math.floor(diffMs / 60000);
      const diffSeconds = Math.floor((diffMs % 60000) / 1000);
      
      if (diffMinutes < 1) {
        setElapsed(`${diffSeconds}s`);
      } else {
        setElapsed(`${diffMinutes}:${diffSeconds.toString().padStart(2, '0')} min`);
      }
    };

    // Atualizar imediatamente
    updateTimer();

    // Atualizar a cada segundo
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [waitingSince]);

  return (
    <span className="flex-shrink-0 text-xs text-slate-600 font-medium">
      Aguardando há {elapsed}
    </span>
  );
}

type FilterType = 'all' | 'unread' | 'resolved';

export default function ConversationsPage() {
  const { token } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const headers: HeadersInit = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        
        // Buscar conversas e notificações em paralelo
        const [conversationsRes, notificationsRes] = await Promise.all([
          fetch(`${API_BASE}/api/v1/conversations`, { headers }),
          fetch(`${API_BASE}/api/v1/notifications/unread`, { headers }),
        ]);
        
        const conversationsData = await conversationsRes.json();
        const notificationsData = await notificationsRes.json();
        
        if (conversationsData.success && Array.isArray(conversationsData.data)) {
          setConversations(conversationsData.data);
        } else {
          console.warn('[ConversationsPage] Invalid conversations response:', conversationsData);
          setConversations([]);
        }
        
        if (notificationsData.success && Array.isArray(notificationsData.data)) {
          setNotifications(notificationsData.data);
        } else {
          setNotifications([]);
        }
      } catch (error) {
        console.error('Failed to fetch data:', error);
        setConversations([]);
        setNotifications([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 5000);

    return () => clearInterval(interval);
  }, [token]);

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString();
  };

  // Formatar tempo de espera (ex: "4:20 min")
  const formatWaitingTime = (waitingSince: number): string => {
    const now = Date.now();
    const diffMs = now - waitingSince;
    const diffMinutes = Math.floor(diffMs / 60000);
    const diffSeconds = Math.floor((diffMs % 60000) / 1000);
    
    if (diffMinutes < 1) {
      return `${diffSeconds}s`;
    }
    
    return `${diffMinutes}:${diffSeconds.toString().padStart(2, '0')} min`;
  };

  // Verificar se conversa precisa de humano (IA desativada, estado waiting_human ou notificação handoff não lida)
  const needsHuman = (conv: Conversation): { needs: boolean; severity?: 'warning' | 'error'; isWaitingHuman?: boolean } => {
    // Verificar se está em estado waiting_human
    if (conv.state === 'waiting_human' || conv.waitingHumanAt) {
      return { needs: true, severity: 'warning', isWaitingHuman: true };
    }
    
    if (conv.aiEnabled === false) {
      // IA desativada = sempre vermelho (crítico)
      return { needs: true, severity: 'error' };
    }
    const handoffNotification = notifications.find(
      n => n.conversationId === conv.conversationId && 
           n.type === 'handoff_requested' && 
           !n.isRead
    );
    if (handoffNotification) {
      const severity = (handoffNotification.metadata?.severity as 'warning' | 'error') || 'warning';
      return { needs: true, severity };
    }
    return { needs: false };
  };

  // Filtrar e buscar conversas
  const filteredAndSearchedConversations = conversations.filter((conv) => {
    // Filtro por tipo
    if (filter === 'unread' && conv.unreadCount === 0) return false;
    if (filter === 'resolved' && conv.state !== 'archived') return false;
    
    // Busca por nome ou número de telefone
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const name = (conv.sender.pushName || conv.sender.phoneNumber).toLowerCase();
      const phone = conv.sender.phoneNumber.toLowerCase();
      const lastMessageText = conv.lastMessage?.text?.toLowerCase() || '';
      
      if (!name.includes(query) && !phone.includes(query) && !lastMessageText.includes(query)) {
        return false;
      }
    }
    
    return true;
  });

  // Ordenar conversas: handoff primeiro (erro antes de warning), depois por data
  const sortedConversations = [...filteredAndSearchedConversations].sort((a, b) => {
    const aHuman = needsHuman(a);
    const bHuman = needsHuman(b);
    
    // Priorizar conversas que precisam de humano
    if (aHuman.needs && !bHuman.needs) return -1;
    if (!aHuman.needs && bHuman.needs) return 1;
    
    // Se ambas precisam, priorizar erro (vermelho) sobre warning (amarelo)
    if (aHuman.needs && bHuman.needs) {
      if (aHuman.severity === 'error' && bHuman.severity === 'warning') return -1;
      if (aHuman.severity === 'warning' && bHuman.severity === 'error') return 1;
    }
    
    // Se ambas precisam ou não precisam, ordenar por data
    return b.lastMessageAt - a.lastMessageAt;
  });

  // Formatar horário relativo ou absoluto
  const formatTime = (timestamp: number): string => {
    const now = Date.now();
    const diffMs = now - timestamp;
    const diffMinutes = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMinutes < 1) return 'Agora';
    if (diffMinutes < 60) return `${diffMinutes}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    
    return new Date(timestamp).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit'
    });
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
        <div className="max-w-7xl mx-auto">
          {/* Header com Título, Busca e Filtros */}
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Conversations</h1>
            
            <div className="flex items-center gap-3">
              {/* Input de Busca */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar conversas..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 w-64 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm text-slate-900 placeholder-slate-400"
                />
              </div>
              
              {/* Dropdown de Filtros */}
              <div className="relative">
                <button
                  onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                  className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium text-slate-700"
                >
                  <Filter className="w-4 h-4" />
                  <span>
                    {filter === 'all' ? 'Todos' : filter === 'unread' ? 'Não Lidos' : 'Resolvidos'}
                  </span>
                </button>
                
                {showFilterDropdown && (
                  <>
                    <div 
                      className="fixed inset-0 z-10" 
                      onClick={() => setShowFilterDropdown(false)}
                    />
                    <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-lg shadow-lg z-20">
                      <button
                        onClick={() => {
                          setFilter('all');
                          setShowFilterDropdown(false);
                        }}
                        className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-50 transition-colors ${
                          filter === 'all' ? 'bg-green-50 text-green-700 font-medium' : 'text-slate-700'
                        }`}
                      >
                        Todos
                      </button>
                      <button
                        onClick={() => {
                          setFilter('unread');
                          setShowFilterDropdown(false);
                        }}
                        className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-50 transition-colors ${
                          filter === 'unread' ? 'bg-green-50 text-green-700 font-medium' : 'text-slate-700'
                        }`}
                      >
                        Não Lidos
                      </button>
                      <button
                        onClick={() => {
                          setFilter('resolved');
                          setShowFilterDropdown(false);
                        }}
                        className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-50 transition-colors ${
                          filter === 'resolved' ? 'bg-green-50 text-green-700 font-medium' : 'text-slate-700'
                        }`}
                      >
                        Resolvidos
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Container Principal - Lista Densa */}
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
            {!Array.isArray(sortedConversations) || sortedConversations.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <p className="text-slate-500 text-base font-medium">Nenhuma conversa encontrada</p>
                <p className="text-sm text-slate-400 mt-1">
                  {searchQuery || filter !== 'all' 
                    ? 'Tente ajustar os filtros de busca' 
                    : 'As conversas aparecerão aqui quando chegarem'}
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {sortedConversations.map((conv) => {
                const humanInfo = needsHuman(conv);
                const hasHandoff = humanInfo.needs;
                const severity = humanInfo.severity;
                  
                return (
                    <li key={conv.conversationId} className="group relative">
                  <Link
                    href={`/conversations/${conv.conversationId}`}
                        className="flex items-center gap-4 px-6 py-3 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                        {/* Avatar com Status */}
                        <div className="flex-shrink-0 relative">
                          {conv.sender.profilePictureUrl ? (
                            <img
                              src={conv.sender.profilePictureUrl}
                              alt={conv.sender.pushName || conv.sender.phoneNumber}
                              className="h-10 w-10 rounded-full object-cover"
                            />
                          ) : (
                            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
                              <span className="text-white text-sm font-bold">
                                {(conv.sender.pushName || conv.sender.phoneNumber)[0].toUpperCase()}
                              </span>
                            </div>
                          )}
                          {/* Anel de status verde (ativo/online) */}
                          <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                        </div>
                        
                        {/* Conteúdo Central */}
                            <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="font-semibold text-slate-900 truncate text-sm">
                                  {conv.sender.pushName || conv.sender.phoneNumber}
                                </p>
                            
                            {/* Badges de Status */}
                                {hasHandoff && (
                              <span className={`flex-shrink-0 inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${
                                      severity === 'error' 
                                  ? 'bg-red-100 text-red-700' 
                                        : severity === 'warning'
                                  ? 'bg-yellow-100 text-yellow-700'
                                  : 'bg-red-100 text-red-700'
                                    }`}>
                                {severity === 'error' ? '🔴' : severity === 'warning' ? '⚠️' : '⚠️'} {humanInfo.isWaitingHuman ? 'Aguardando' : 'HUMANO'}
                                    </span>
                            )}
                            
                            {conv.state === 'archived' && (
                              <span className="flex-shrink-0 inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-slate-100 text-slate-700">
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                Resolvido
                                  </span>
                                )}
                            
                            {/* Badges dos Agentes */}
                            {conv.agentNames && conv.agentNames.length > 0 && (
                              <>
                                {conv.agentNames.map((agentName, index) => {
                                  const agentColor = conv.agentColors?.[agentName] || '#3B82F6'; // Cor padrão azul
                                  // Converter hex para RGB para calcular cor de texto (clara ou escura)
                                  const hex = agentColor.replace('#', '');
                                  const r = parseInt(hex.substr(0, 2), 16);
                                  const g = parseInt(hex.substr(2, 2), 16);
                                  const b = parseInt(hex.substr(4, 2), 16);
                                  // Calcular luminosidade (0-255)
                                  const luminance = (0.299 * r + 0.587 * g + 0.114 * b);
                                  const textColor = luminance > 128 ? '#1F2937' : '#FFFFFF'; // Escuro ou branco
                                  
                                  return (
                                    <span 
                                      key={index}
                                      className="flex-shrink-0 inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full"
                                      style={{
                                        backgroundColor: `${agentColor}20`, // 20 = 12.5% opacity
                                        color: agentColor,
                                        border: `1px solid ${agentColor}40`, // 40 = 25% opacity
                                      }}
                                    >
                                      👤 {agentName}
                                    </span>
                                  );
                                })}
                              </>
                            )}
                              </div>
                          
                          {/* Preview da Mensagem */}
                              {conv.lastMessage ? (
                            <p className="text-slate-500 text-sm truncate">
                              {conv.lastMessage.fromMe && (
                                <span className="text-slate-400">Você: </span>
                                    )}
                                  {conv.lastMessage.type === 'image' && '📷 '}
                                  {conv.lastMessage.type === 'audio' && '🎵 '}
                                  {conv.lastMessage.type === 'video' && '🎬 '}
                                  {conv.lastMessage.type === 'document' && '📄 '}
                                  {conv.lastMessage.text || 
                                    (conv.lastMessage.type === 'image' && 'Imagem') ||
                                    (conv.lastMessage.type === 'audio' && 'Áudio') ||
                                    (conv.lastMessage.type === 'video' && 'Vídeo') ||
                                    (conv.lastMessage.type === 'document' && 'Documento') ||
                                    'Mensagem'}
                                </p>
                              ) : (
                            <p className="text-slate-400 text-sm italic">Nenhuma mensagem</p>
                              )}
                            </div>
                        
                        {/* Coluna da Direita - Metadados */}
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <div className="text-right">
                            <p className="text-xs text-slate-400 font-medium">
                              {formatTime(conv.lastMessageAt)}
                                </p>
                          </div>
                          
                          {/* Indicador de Não Lido */}
                          {conv.unreadCount > 0 && (
                            <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                          )}
                          
                          {/* Botão de Ações Rápidas (aparece no hover) */}
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              // TODO: Implementar menu de ações rápidas
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-slate-200 rounded transition-all"
                            title="Ações rápidas"
                          >
                            <MoreVertical className="w-4 h-4 text-slate-500" />
                          </button>
                    </div>
                  </Link>
                </li>
              );
                })}
              </ul>
            )}
        </div>
      </div>
    </DashboardLayout>
    </ProtectedRoute>
  );
}

