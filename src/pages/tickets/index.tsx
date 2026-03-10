import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Filter, CheckCircle, MessageSquare, Clock, AlertCircle } from 'lucide-react';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import { ProtectedRoute } from '../../components/ProtectedRoute';
import { useAuth } from '../../contexts/AuthContext';

type Ticket = {
  id: string;
  conversationId: string;
  storeId?: string | null;
  status: 'open' | 'in_progress' | 'closed';
  priority: 'urgent' | 'high' | 'normal';
  title: string;
  summary?: string | null;
  reason: string;
  source: 'system' | 'manual';
  assignedToUserId?: string | null;
  createdAt: number;
  updatedAt: number;
  resolvedAt?: number | null;
};

type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'agent';
};

type ConversationInfo = {
  conversationId: string;
  sender: {
    phoneNumber: string;
    pushName?: string;
    profilePictureUrl?: string;
  };
};

type StatusTab = 'all' | 'open' | 'in_progress' | 'closed';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function TicketsPage() {
  const { token, user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [conversations, setConversations] = useState<Record<string, ConversationInfo>>({});
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<StatusTab>('all');
  const [selectedAgent, setSelectedAgent] = useState<string>('all'); // 'all' | 'unassigned' | userId

  useEffect(() => {
    const fetchTickets = async () => {
      try {
        const headers: HeadersInit = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        
        console.log('[TicketsPage] Fetching tickets...', { API_BASE, hasToken: !!token });
        const res = await fetch(`${API_BASE}/api/v1/tickets`, { headers });
        const data = await res.json();
        
        console.log('[TicketsPage] Response:', {
          success: data.success,
          dataLength: data.data?.length || 0,
          data: data.data,
          error: data.message,
        });
        
        if (data.success) {
          setTickets(data.data || []);
        } else {
          console.error('[TicketsPage] Failed to fetch tickets:', data);
          setTickets([]);
        }
      } catch (error) {
        console.error('[TicketsPage] Error fetching tickets:', error);
        setTickets([]);
      } finally {
        setLoading(false);
      }
    };

    const markAsViewed = async () => {
      if (!token) return;
      
      try {
        const headers: HeadersInit = {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        };
        
        // Marcar tickets como visualizados quando acessar a página
        await fetch(`${API_BASE}/api/v1/tickets/viewed`, {
          method: 'POST',
          headers,
        });
        
        console.log('[TicketsPage] ✅ Tickets marked as viewed');
      } catch (error) {
        console.error('[TicketsPage] Error marking tickets as viewed:', error);
        // Não bloquear se falhar
      }
    };

    if (token) {
      // Marcar como visualizado imediatamente ao carregar a página
      markAsViewed();
      
      fetchTickets();
      const interval = setInterval(fetchTickets, 5000);

      return () => clearInterval(interval);
    } else {
      setLoading(false);
    }
  }, [token]);

  // Buscar informações das conversas
  useEffect(() => {
    const fetchConversations = async () => {
      if (!token || tickets.length === 0) return;

      try {
        const headers: HeadersInit = {
          'Authorization': `Bearer ${token}`,
        };

        const conversationIds = [...new Set(tickets.map(t => t.conversationId))];
        const conversationPromises = conversationIds.map(async (convId) => {
          try {
            const res = await fetch(`${API_BASE}/api/v1/conversations/${convId}`, { headers });
            const data = await res.json();
            if (data.success) {
              return { conversationId: convId, conversation: data.data };
            }
          } catch (error) {
            console.error(`Error fetching conversation ${convId}:`, error);
    }
          return null;
        });

        const results = await Promise.all(conversationPromises);
        const conversationsMap: Record<string, ConversationInfo> = {};
        
        results.forEach((result) => {
          if (result) {
            conversationsMap[result.conversationId] = {
              conversationId: result.conversationId,
              sender: result.conversation.sender,
            };
          }
        });

        setConversations(conversationsMap);
      } catch (error) {
        console.error('Error fetching conversations:', error);
    }
  };

    fetchConversations();
  }, [token, tickets]);

  // Buscar membros da equipe para o filtro
  useEffect(() => {
    const fetchTeamMembers = async () => {
      if (!token) return;

      try {
        const headers: HeadersInit = {
          'Authorization': `Bearer ${token}`,
        };
        
        const res = await fetch(`${API_BASE}/api/v1/team`, { headers });
        const data = await res.json();
        
        if (data.success) {
          setTeamMembers(data.data || []);
        }
      } catch (error) {
        console.error('Error fetching team members:', error);
      }
    };

    fetchTeamMembers();
  }, [token]);


  // Filtrar tickets
  const filteredTickets = tickets.filter((ticket) => {
    // Filtro por status (aba)
    if (activeTab !== 'all') {
      if (activeTab === 'open') {
        // "Abertos" = status 'open' E não atribuído (pendentes/sem dono)
        if (ticket.status !== 'open' || ticket.assignedToUserId) return false;
      } else if (activeTab === 'in_progress') {
        // "Em Progresso" = status 'in_progress' OU (status 'open' mas atribuído)
        const isInProgress = ticket.status === 'in_progress' || (ticket.status === 'open' && ticket.assignedToUserId);
        if (!isInProgress) return false;
      } else if (activeTab === 'closed') {
        if (ticket.status !== 'closed') return false;
      }
    }

    // Filtro por atendente
    if (selectedAgent === 'unassigned') {
      if (ticket.assignedToUserId !== null && ticket.assignedToUserId !== undefined) return false;
    } else if (selectedAgent !== 'all') {
      if (ticket.assignedToUserId !== selectedAgent) return false;
    }

    return true;
  });

  // Função para obter nome do atendente
  const getAgentName = (agentId: string | null | undefined): string | null => {
    if (!agentId) return null;
    const member = teamMembers.find(m => m.id === agentId);
    return member?.name || null;
  };

  // Ordenar tickets: urgentes primeiro, depois por data (mais recentes primeiro)
  const sortedTickets = [...filteredTickets].sort((a, b) => {
    if (a.priority === 'urgent' && b.priority !== 'urgent') return -1;
    if (a.priority !== 'urgent' && b.priority === 'urgent') return 1;
    return b.createdAt - a.createdAt;
  });

  // Calcular métricas
  const openTickets = tickets.filter(t => t.status === 'open' || t.status === 'in_progress').length;
  const inProgressTickets = tickets.filter(t => t.status === 'in_progress').length;
  const closedTickets = tickets.filter(t => t.status === 'closed').length;

  // Formatar tempo relativo
  const formatTimeAgo = (timestamp: number): string => {
    const now = Date.now();
    const diffMs = now - timestamp;
    const diffMinutes = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMinutes < 1) return 'Agora';
    if (diffMinutes < 60) return `Há ${diffMinutes} min`;
    if (diffHours < 24) return `Há ${diffHours}h`;
    if (diffDays < 7) return `Há ${diffDays}d`;
    
    return new Date(timestamp).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit'
    });
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return { color: 'bg-red-500', label: 'Urgente' };
      case 'high':
        return { color: 'bg-yellow-500', label: 'Alta' };
      default:
        return { color: 'bg-green-500', label: 'Normal' };
    }
  };

  const handleResolveTicket = async (ticketId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!token) return;
    
    try {
      const headers: HeadersInit = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      };
      
      const response = await fetch(`${API_BASE}/api/v1/tickets/${ticketId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status: 'closed' }),
      });
      
      const data = await response.json();
      if (data.success) {
        // Recarregar tickets
        const res = await fetch(`${API_BASE}/api/v1/tickets`, { headers });
        const ticketsData = await res.json();
        if (ticketsData.success) {
          setTickets(ticketsData.data || []);
        }
      }
    } catch (error) {
      console.error('Error resolving ticket:', error);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center items-center h-64">
          <div className="text-gray-500">Loading...</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Tickets</h1>
              
              {/* Filtro de Atendentes */}
              <div className="flex items-center gap-3">
                <select
                  value={selectedAgent}
                  onChange={(e) => setSelectedAgent(e.target.value)}
                  className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="all">Todos os Atendentes</option>
                  <option value="unassigned">Não Atribuído</option>
                  {teamMembers.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </select>
                
                {/* Botão Meus Tickets (atalho) */}
                {user && (
                  <button
                    onClick={() => {
                      setSelectedAgent(user.id);
                      setActiveTab('in_progress');
                    }}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                  >
                    Meus Tickets
                  </button>
                )}
              </div>
            </div>

          </div>

          {/* Métricas (Bento Mini) */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{openTickets}</p>
                  <p className="text-xs text-slate-500 font-medium">Abertos</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{inProgressTickets}</p>
                  <p className="text-xs text-slate-500 font-medium">Em Progresso</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{closedTickets}</p>
                  <p className="text-xs text-slate-500 font-medium">Fechados</p>
                </div>
              </div>
            </div>
          </div>

          {/* Abas de Status e Filtros */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              {/* Abas de Status */}
              <div className="flex items-center gap-1 border-b border-slate-200">
                <button
                  onClick={() => setActiveTab('all')}
                  className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                    activeTab === 'all'
                      ? 'border-slate-900 text-slate-900'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Todos
                </button>
                <button
                  onClick={() => setActiveTab('open')}
                  className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                    activeTab === 'open'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Abertos
                </button>
                <button
                  onClick={() => setActiveTab('in_progress')}
                  className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                    activeTab === 'in_progress'
                      ? 'border-amber-600 text-amber-600'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Em Progresso
                </button>
                <button
                  onClick={() => setActiveTab('closed')}
                  className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                    activeTab === 'closed'
                      ? 'border-green-600 text-green-600'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Fechados
                </button>
              </div>

              {/* Filtro de Atendentes */}
              <div className="flex items-center gap-3">
                <select
                  value={selectedAgent}
                  onChange={(e) => setSelectedAgent(e.target.value)}
                  className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="all">Todos os Atendentes</option>
                  <option value="unassigned">Não Atribuído</option>
                  {teamMembers.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </select>
                
                {/* Botão Meus Tickets (atalho) */}
                {user && (
                  <button
                    onClick={() => {
                      setSelectedAgent(user.id);
                      setActiveTab('in_progress');
                    }}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                  >
                    Meus Tickets
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Tabela Principal */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            {sortedTickets.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <CheckCircle className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500 text-base font-medium">Tudo tranquilo por aqui. Bom trabalho!</p>
                <p className="text-sm text-slate-400 mt-1">Nenhum ticket encontrado</p>
              </div>
            ) : (
              <>
                {/* Cabeçalho da Tabela */}
                <div className="border-b border-slate-200 bg-slate-50/50 px-6 py-3">
                  <div className="grid grid-cols-12 gap-4 text-xs font-semibold text-slate-600 uppercase tracking-wide">
                    <div className="col-span-4">Assunto</div>
                    <div className="col-span-1">Prioridade</div>
                    <div className="col-span-1">Cliente</div>
                    <div className="col-span-2">Atendente</div>
                    <div className="col-span-1">Status</div>
                    <div className="col-span-2">Tempo Aberto</div>
                    <div className="col-span-1 text-right">Ações</div>
                  </div>
                </div>

                {/* Linhas da Tabela */}
                <div className="divide-y divide-slate-100">
                  {sortedTickets.map((ticket) => {
                    const conversation = conversations[ticket.conversationId];
                    const priorityBadge = getPriorityBadge(ticket.priority);
                    const isUrgent = ticket.priority === 'urgent' && ticket.status !== 'closed';
                    const timeAgo = formatTimeAgo(ticket.createdAt);
                    const isOld = Date.now() - ticket.createdAt > 4 * 60 * 60 * 1000; // > 4 horas
                    
                    return (
                  <Link
                        key={ticket.id}
                    href={`/tickets/${ticket.id}`}
                        className={`block hover:bg-slate-50/50 transition-colors ${
                          isUrgent ? 'bg-red-50/50' : ''
                        }`}
                  >
                    <div className="px-6 py-4">
                          <div className="grid grid-cols-12 gap-4 items-center">
                            {/* Assunto */}
                            <div className="col-span-4">
                              <p className="text-sm font-medium text-slate-900 mb-1.5">
                                {ticket.title}
                              </p>
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                                {ticket.reason}
                              </span>
                        </div>

                            {/* Prioridade */}
                            <div className="col-span-1">
                              <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${priorityBadge.color}`}></div>
                                <span className="text-xs font-medium text-slate-700">
                                  {priorityBadge.label}
                                </span>
                              </div>
                            </div>

                            {/* Cliente */}
                            <div className="col-span-1">
                              {conversation ? (
                                <div className="flex items-center gap-2">
                                  {conversation.sender.profilePictureUrl ? (
                                    <img
                                      src={conversation.sender.profilePictureUrl}
                                      alt={conversation.sender.pushName || conversation.sender.phoneNumber}
                                      className="w-6 h-6 rounded-full object-cover flex-shrink-0"
                                    />
                                  ) : (
                                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center flex-shrink-0">
                                      <span className="text-white text-xs font-bold">
                                        {(conversation.sender.pushName || conversation.sender.phoneNumber)[0].toUpperCase()}
                                      </span>
                                    </div>
                                  )}
                                  <span className="text-sm text-slate-700 truncate">
                                    {conversation.sender.pushName || conversation.sender.phoneNumber}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-xs text-slate-400">Carregando...</span>
                              )}
                            </div>

                            {/* Atendente */}
                            <div className="col-span-2">
                              {ticket.assignedToUserId ? (
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                                    <span className="text-blue-700 text-xs font-bold">
                                      {getAgentName(ticket.assignedToUserId)?.charAt(0).toUpperCase() || '?'}
                                    </span>
                                  </div>
                                  <span className="text-sm text-slate-700 whitespace-nowrap">
                                    {getAgentName(ticket.assignedToUserId) || 'Desconhecido'}
                                  </span>
                                </div>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200">
                                  Sem dono
                                </span>
                              )}
                            </div>

                            {/* Status */}
                            <div className="col-span-1">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                ticket.status === 'open' 
                                  ? 'bg-blue-100 text-blue-700'
                                  : ticket.status === 'in_progress'
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-green-100 text-green-700'
                              }`}>
                            {ticket.status === 'open' ? 'Aberto' : ticket.status === 'in_progress' ? 'Em Progresso' : 'Fechado'}
                          </span>
                        </div>

                            {/* Tempo Aberto */}
                            <div className="col-span-2">
                              <div className="flex items-center gap-1.5">
                                <Clock className={`w-3.5 h-3.5 ${isOld ? 'text-red-500' : 'text-slate-400'}`} />
                                <span className={`text-xs font-medium ${isOld ? 'text-red-600' : 'text-slate-600'}`}>
                                  {timeAgo}
                                </span>
                              </div>
                            </div>

                            {/* Ações */}
                            <div className="col-span-1 flex items-center justify-end gap-2">
                              <Link
                                href={`/conversations/${ticket.conversationId}`}
                                onClick={(e) => e.stopPropagation()}
                                className="p-1.5 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                                title="Ver Conversa"
                              >
                                <MessageSquare className="w-4 h-4" />
                              </Link>
                              {ticket.status !== 'closed' && (
                                <button
                                  onClick={(e) => handleResolveTicket(ticket.id, e)}
                                  className="p-1.5 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                                  title="Marcar Fechado"
                                >
                                  <CheckCircle className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                      </div>
                    </div>
                  </Link>
                    );
                  })}
                </div>
              </>
            )}
        </div>
      </div>
    </DashboardLayout>
    </ProtectedRoute>
  );
}

