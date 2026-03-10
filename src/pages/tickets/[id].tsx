import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { 
  ChevronRight, 
  Archive, 
  Trash2, 
  User, 
  Phone, 
  Clock, 
  AlertCircle, 
  MessageSquare,
  CheckCircle,
  XCircle,
  Circle,
  Tag,
  Send
} from 'lucide-react';
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

type ConversationInfo = {
  conversationId: string;
  sender: {
    phoneNumber: string;
    pushName?: string;
    profilePictureUrl?: string;
  };
};

type TicketLog = {
  id: string;
  ticketId: string;
  authorType: 'system' | 'human';
  authorId?: string | null;
  authorName?: string | null; // Nome do usuário (se authorType = 'human')
  actionType: 'created' | 'status_changed' | 'note_added' | 'assigned' | 'unassigned';
  fromStatus?: string | null;
  toStatus?: string | null;
  note?: string | null;
  createdAt: number;
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const TICKET_STATUSES = ['open', 'in_progress', 'closed'] as const;

export default function TicketDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const { token, user } = useAuth();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [logs, setLogs] = useState<TicketLog[]>([]);
  const [conversation, setConversation] = useState<ConversationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [noteText, setNoteText] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [updatingPriority, setUpdatingPriority] = useState(false);
  const [claimingTicket, setClaimingTicket] = useState(false);

  useEffect(() => {
    if (!id || typeof id !== 'string') return;

    const fetchTicket = async () => {
      try {
        const headers: HeadersInit = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        
        console.log('[TicketDetailPage] Fetching ticket:', { id, API_BASE });
        const res = await fetch(`${API_BASE}/api/v1/tickets/${id}`, { headers });
        const data = await res.json();
        
        console.log('[TicketDetailPage] Response:', {
          success: data.success,
          hasData: !!data.data,
          error: data.message,
        });
        
        if (data.success) {
          setTicket(data.data);
        } else {
          console.error('[TicketDetailPage] Failed to fetch ticket:', data);
        }
      } catch (error) {
        console.error('[TicketDetailPage] Error fetching ticket:', error);
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
        
        // Marcar tickets como visualizados quando acessar a página de detalhes
        await fetch(`${API_BASE}/api/v1/tickets/viewed`, {
          method: 'POST',
          headers,
        });
        
        console.log('[TicketDetailPage] ✅ Tickets marked as viewed');
      } catch (error) {
        console.error('[TicketDetailPage] Error marking tickets as viewed:', error);
        // Não bloquear se falhar
      }
    };

    const fetchConversation = async () => {
      if (!ticket?.conversationId || !token) return;
      
      try {
        const headers: HeadersInit = {
          'Authorization': `Bearer ${token}`,
        };
        
        const res = await fetch(`${API_BASE}/api/v1/conversations/${ticket.conversationId}`, { headers });
        const data = await res.json();
        
        if (data.success) {
          setConversation({
            conversationId: ticket.conversationId,
            sender: data.data.sender,
          });
        }
      } catch (error) {
        console.error('Error fetching conversation:', error);
      }
    };

    const fetchData = async () => {
      await fetchTicket();
      await fetchLogs();
    };

    // Marcar como visualizado imediatamente ao carregar a página
    markAsViewed();

    fetchData();
    const interval = setInterval(fetchData, 5000);

    return () => clearInterval(interval);
  }, [id, token]);

  // Buscar conversa quando o ticket for carregado
  useEffect(() => {
    if (ticket?.conversationId && token) {
      const fetchConversation = async () => {
        try {
          const headers: HeadersInit = {
            'Authorization': `Bearer ${token}`,
          };
          
          const res = await fetch(`${API_BASE}/api/v1/conversations/${ticket.conversationId}`, { headers });
          const data = await res.json();
          
          if (data.success) {
            setConversation({
              conversationId: ticket.conversationId,
              sender: data.data.sender,
            });
          }
        } catch (error) {
          console.error('Error fetching conversation:', error);
        }
      };
      
      fetchConversation();
    }
  }, [ticket?.conversationId, token]);

  const fetchLogs = async () => {
    if (!id || typeof id !== 'string') return;

    try {
      const headers: HeadersInit = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const res = await fetch(`${API_BASE}/api/v1/tickets/${id}/logs`, { headers });
      const data = await res.json();
      
      if (data.success) {
        setLogs(data.data || []);
      }
    } catch (error) {
      console.error('[TicketDetailPage] Error fetching logs:', error);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!id || typeof id !== 'string' || !ticket || updatingStatus) return;

    console.log('[TicketDetailPage] Changing status:', { 
      ticketId: id, 
      currentStatus: ticket.status, 
      newStatus,
      validStatuses: ['open', 'in_progress', 'closed']
    });

    setUpdatingStatus(true);
    try {
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const res = await fetch(`${API_BASE}/api/v1/tickets/${id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await res.json();
      
      console.log('[TicketDetailPage] Status change response:', {
        status: res.status,
        success: data.success,
        data: data.data,
        error: data.message,
        details: data.details,
      });

      if (data.success) {
        setTicket(data.data);
        await fetchLogs();
      } else {
        console.error('[TicketDetailPage] Failed to update status:', data);
        alert(`Erro ao atualizar status: ${data.message || 'Erro desconhecido'}`);
      }
    } catch (error: any) {
      console.error('[TicketDetailPage] Error updating ticket status:', error);
      alert(`Erro ao atualizar status: ${error?.message || 'Erro de conexão'}`);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handlePriorityChange = async (newPriority: string) => {
    if (!id || typeof id !== 'string' || !ticket || updatingPriority) return;

    setUpdatingPriority(true);
    try {
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const res = await fetch(`${API_BASE}/api/v1/tickets/${id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ priority: newPriority }),
      });

      const data = await res.json();
      if (data.success) {
        setTicket(data.data);
        await fetchLogs();
      }
    } catch (error) {
      console.error('Failed to update ticket priority:', error);
    } finally {
      setUpdatingPriority(false);
    }
  };

  const handleAddNote = async () => {
    if (!id || typeof id !== 'string' || !noteText.trim()) return;

    setAddingNote(true);
    try {
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const res = await fetch(`${API_BASE}/api/v1/tickets/${id}/notes`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ note: noteText.trim() }),
      });

      const data = await res.json();
      if (data.success) {
        setNoteText('');
        await fetchLogs(); // Atualizar logs
      }
    } catch (error) {
      console.error('Failed to add note:', error);
    } finally {
      setAddingNote(false);
    }
  };

  const handleReenableAI = async () => {
    if (!ticket) return;

    try {
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const res = await fetch(`${API_BASE}/api/v1/conversations/${ticket.conversationId}/ai/enable`, {
        method: 'PATCH',
        headers,
      });

      const data = await res.json();
      if (data.success) {
        alert('IA reativada com sucesso!');
      }
    } catch (error) {
      console.error('Failed to reenable AI:', error);
      alert('Erro ao reativar IA');
    }
  };

  const handleClaimTicket = async () => {
    if (!id || typeof id !== 'string' || !ticket || !user || claimingTicket) return;

    setClaimingTicket(true);
    try {
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const res = await fetch(`${API_BASE}/api/v1/tickets/${id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ assignedToUserId: user.id }),
      });

      const data = await res.json();
      if (data.success) {
        setTicket(data.data);
        await fetchLogs(); // Atualizar logs para mostrar a ação na timeline
      } else {
        alert(`Erro ao assumir ticket: ${data.message || 'Erro desconhecido'}`);
      }
    } catch (error) {
      console.error('Failed to claim ticket:', error);
      alert('Erro ao assumir ticket. Tente novamente.');
    } finally {
      setClaimingTicket(false);
    }
  };

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString('pt-BR');
  };

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

  const getLogIcon = (actionType: string) => {
    switch (actionType) {
      case 'created':
        return <Circle className="w-4 h-4 text-green-500" />;
      case 'status_changed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'note_added':
        return <MessageSquare className="w-4 h-4 text-purple-500" />;
      case 'assigned':
        return <User className="w-4 h-4 text-orange-500" />;
      default:
        return <Circle className="w-4 h-4 text-slate-400" />;
    }
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

  if (!ticket) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="px-4 py-6 sm:px-0">
            <div className="text-center text-gray-500">Ticket not found</div>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    );
  }

  const isUrgent = ticket.priority === 'urgent';

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="max-w-7xl mx-auto">
          {/* Header Minimalista */}
          <div className="mb-6">
            {/* Breadcrumbs */}
            <div className="flex items-center gap-2 text-sm text-slate-500 mb-4">
              <Link href="/tickets" className="hover:text-slate-700">
                Tickets
              </Link>
              <ChevronRight className="w-4 h-4" />
              <span className="text-slate-700 font-medium">#{ticket.id.substring(0, 8)}</span>
            </div>

            {/* Título e Ações */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                  {ticket.title}
                </h1>
                {isUrgent && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold border border-red-300">
                    <AlertCircle className="w-3.5 h-3.5" />
                    URGENTE
                  </span>
                )}
              </div>
              
              {/* Ações no Topo */}
              <div className="flex items-center gap-2">
                <button
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                  title="Arquivar"
                >
                  <Archive className="w-5 h-5" />
                </button>
                <button
                  className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Deletar"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Layout Grid 2/3 + 1/3 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Coluna Principal (2/3) */}
            <div className="lg:col-span-2 space-y-6">

              {/* Card do Problema */}
              <div className={`bg-white border border-slate-200 rounded-xl shadow-sm p-6 ${
                isUrgent ? 'bg-red-50/30 border-red-200' : ''
              }`}>
                <div className="space-y-4">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900 mb-2">Descrição do Problema</h2>
                    {ticket.summary ? (
                      <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                        {ticket.summary}
                      </p>
                    ) : (
                      <p className="text-sm text-slate-500 italic">Sem descrição adicional</p>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-4 text-xs text-slate-500 pt-4 border-t border-slate-200">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Criado {formatTimeAgo(ticket.createdAt)}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5" />
                      <span className="font-mono">{ticket.reason}</span>
                    </div>
                    <div>
                      <span>Fonte: {ticket.source === 'system' ? 'Sistema' : 'Manual'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Timeline de Atividade */}
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
                <h2 className="text-lg font-semibold text-slate-900 mb-6">Atividade</h2>
                
                <div className="space-y-6">
                  {logs.length === 0 ? (
                    <p className="text-sm text-slate-500 text-center py-8">Nenhuma atividade ainda</p>
                  ) : (
                    logs.map((log, index) => (
                      <div key={log.id} className="relative flex gap-4">
                        {/* Linha Vertical */}
                        {index < logs.length - 1 && (
                          <div className="absolute left-2 top-8 w-0.5 h-full bg-slate-200"></div>
                        )}
                        
                        {/* Ícone */}
                        <div className="relative z-10 flex-shrink-0">
                          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center border-2 border-white">
                            {getLogIcon(log.actionType)}
                          </div>
                        </div>
                        
                        {/* Conteúdo */}
                        <div className="flex-1 min-w-0 pb-6">
                          <div className="flex items-start justify-between mb-1">
                            <div>
                              <p className="text-sm font-medium text-slate-900">
                                {log.actionType === 'created' && 'Ticket criado'}
                                {log.actionType === 'status_changed' && `Status alterado: ${log.fromStatus || 'N/A'} → ${log.toStatus || 'N/A'}`}
                                {log.actionType === 'note_added' && 'Nota adicionada'}
                                {log.actionType === 'assigned' && 'Ticket atribuído'}
                                {log.actionType === 'unassigned' && 'Ticket desatribuído'}
                              </p>
                              <p className="text-xs text-slate-500 mt-0.5">
                                {log.authorType === 'system' 
                                  ? 'Sistema' 
                                  : log.authorName 
                                    ? log.authorName 
                                    : `Usuário ${log.authorId || 'desconhecido'}`
                                }
                              </p>
                            </div>
                            <span className="text-xs text-slate-400 flex-shrink-0 ml-4">
                              {formatTimeAgo(log.createdAt)}
                            </span>
                          </div>
                          
                          {/* Nota */}
                          {log.note && (
                            <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                              <div className="flex items-start gap-3">
                                <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                                  <User className="w-3.5 h-3.5 text-white" />
                                </div>
                                <p className="text-sm text-slate-700 flex-1">{log.note}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Input de Nota (Fixo ao final) */}
                <div className="mt-6 pt-6 border-t border-slate-200">
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <textarea
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        placeholder="Adicionar uma nota..."
                        className="w-full px-4 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                        rows={2}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                            e.preventDefault();
                            handleAddNote();
                          }
                        }}
                      />
                    </div>
                    <button
                      onClick={handleAddNote}
                      disabled={!noteText.trim() || addingNote}
                      className="px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                    >
                      <Send className="w-4 h-4" />
                      {addingNote ? 'Enviando...' : 'Enviar'}
                    </button>
                  </div>
                  <p className="text-xs text-slate-400 mt-2">Pressione Cmd/Ctrl + Enter para enviar</p>
                </div>
              </div>
            </div>

            {/* Sidebar (1/3) */}
            <div className="space-y-6">
              {/* Painel de Status */}
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
                <h3 className="text-sm font-semibold text-slate-900 mb-4">Controle</h3>
                
                <div className="space-y-4">
                  {/* Status */}
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-2">
                      Status
                    </label>
                    <select
                      value={ticket.status}
                      onChange={(e) => handleStatusChange(e.target.value)}
                      disabled={updatingStatus}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white"
                    >
                      <option value="open">Aberto</option>
                      <option value="in_progress">Em Progresso</option>
                      <option value="closed">Fechado</option>
                    </select>
                  </div>

                  {/* Prioridade */}
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-2">
                      Prioridade
                    </label>
                    <select
                      value={ticket.priority}
                      onChange={(e) => handlePriorityChange(e.target.value)}
                      disabled={updatingPriority}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white"
                    >
                      <option value="normal">Normal</option>
                      <option value="high">Alta</option>
                      <option value="urgent">Urgente</option>
                    </select>
                  </div>

                  {/* Botão Assumir Ticket ou Status de Atribuição */}
                  {!ticket.assignedToUserId ? (
                    <button
                      onClick={handleClaimTicket}
                      disabled={claimingTicket || !user}
                      className="w-full px-4 py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                    >
                      {claimingTicket ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Assumindo...
                        </>
                      ) : (
                        <>
                          <User className="w-4 h-4" />
                          🙋‍♂️ Assumir Ticket
                        </>
                      )}
                    </button>
                  ) : (
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-2">
                        Atribuído a
                      </label>
                      <div className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-slate-50 text-slate-700 flex items-center gap-2">
                        {ticket.assignedToUserId === user?.id ? (
                          <>
                            <CheckCircle className="w-4 h-4 text-green-600" />
                            <span className="font-medium">✅ Atribuído a você</span>
                          </>
                        ) : (
                          <>
                            <User className="w-4 h-4 text-slate-400" />
                            <span>Atribuído a outro usuário</span>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Reativar IA */}
                  {ticket.status === 'closed' && (
                    <button
                      onClick={handleReenableAI}
                      className="w-full px-4 py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Reativar IA
                    </button>
                  )}
                </div>
              </div>

              {/* Card do Cliente */}
              {conversation && (
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
                  <h3 className="text-sm font-semibold text-slate-900 mb-4">Cliente</h3>
                  
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      {conversation.sender.profilePictureUrl ? (
                        <img
                          src={conversation.sender.profilePictureUrl}
                          alt={conversation.sender.pushName || conversation.sender.phoneNumber}
                          className="w-12 h-12 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
                          <span className="text-white text-lg font-bold">
                            {(conversation.sender.pushName || conversation.sender.phoneNumber)[0].toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">
                          {conversation.sender.pushName || conversation.sender.phoneNumber}
                        </p>
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                          <Phone className="w-3.5 h-3.5" />
                          <span>{conversation.sender.phoneNumber}</span>
                        </div>
                      </div>
                    </div>

                    <Link
                      href={`/conversations/${ticket.conversationId}`}
                      className="w-full px-4 py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                    >
                      <MessageSquare className="w-4 h-4" />
                      Ir para Conversa
                    </Link>
                  </div>
                </div>
              )}

              {/* Tags e Metadados */}
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
                <h3 className="text-sm font-semibold text-slate-900 mb-4">Metadados</h3>
                
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-slate-500 mb-1.5">Tags</p>
                    <div className="flex flex-wrap gap-2">
                      <span className="px-2.5 py-1 bg-slate-100 text-slate-700 text-xs font-mono rounded-md border border-slate-200">
                        {ticket.reason}
                      </span>
                      {ticket.source === 'system' && (
                        <span className="px-2.5 py-1 bg-green-100 text-green-700 text-xs rounded-md">
                          Sistema
                        </span>
                      )}
                    </div>
                  </div>

                  {ticket.storeId && (
                    <div>
                      <p className="text-xs text-slate-500 mb-1.5">Loja</p>
                      <p className="text-sm text-slate-900 font-medium">{ticket.storeId}</p>
                    </div>
                  )}

                  <div>
                    <p className="text-xs text-slate-500 mb-1.5">ID do Ticket</p>
                    <p className="text-xs font-mono text-slate-600">{ticket.id}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
