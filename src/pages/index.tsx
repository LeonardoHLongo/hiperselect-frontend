import { useEffect, useState } from 'react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { useAuth } from '../contexts/AuthContext';
import { MessageSquare, Ticket, Clock, CheckCircle2, TrendingUp, User } from 'lucide-react';
import Link from 'next/link';

type DashboardStats = {
  conversations: number;
  tickets: number;
  openTickets: number;
  resolvedTickets: number;
};

type RecentTicket = {
  id: string;
  conversationId: string;
  customerName: string;
  reason: string;
  status: string;
  createdAt: number;
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Mock data para o gráfico (7 dias)
const generateMockChartData = () => {
  const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  return days.map((day, index) => ({
    day,
    atendimentos: Math.floor(Math.random() * 50) + 20,
  }));
};

// Calcular estatísticas do gráfico
const calculateChartStats = (data: Array<{ atendimentos: number }>) => {
  const total = data.reduce((sum, item) => sum + item.atendimentos, 0);
  const average = Math.round(total / data.length);
  const max = Math.max(...data.map(item => item.atendimentos));
  const min = Math.min(...data.map(item => item.atendimentos));
  return { total, average, max, min };
};

// Função para formatar tempo relativo
const formatTimeAgo = (timestamp: number): string => {
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMinutes < 1) return 'Agora';
  if (diffMinutes < 60) return `Há ${diffMinutes} min`;
  if (diffHours < 24) return `Há ${diffHours}h`;
  if (diffDays < 7) return `Há ${diffDays} dia${diffDays > 1 ? 's' : ''}`;
  return new Date(timestamp).toLocaleDateString('pt-BR');
};

// Função para obter iniciais do nome
const getInitials = (name: string): string => {
  const parts = name.split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

export default function Dashboard() {
  const { token } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentTickets, setRecentTickets] = useState<RecentTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartData] = useState(generateMockChartData());

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const headers: HeadersInit = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        const [conversationsRes, ticketsRes] = await Promise.all([
          fetch(`${API_BASE}/api/v1/conversations`, { headers }),
          fetch(`${API_BASE}/api/v1/tickets`, { headers }),
        ]);

        const conversations = await conversationsRes.json();
        const tickets = await ticketsRes.json();

        const openTickets = tickets.data?.filter(
          (t: any) => t.status === 'open' || t.status === 'in_progress'
        ).length || 0;

        // Calcular tickets resolvidos (fechados) da semana atual
        const now = Date.now();
        const oneWeekAgo = now - (7 * 24 * 60 * 60 * 1000);
        const resolvedTickets = tickets.data?.filter(
          (t: any) => t.status === 'closed' && t.resolvedAt && t.resolvedAt >= oneWeekAgo
        ).length || 0;

        // Buscar tickets recentes (últimos 5)
        const sortedTickets = tickets.data
          ?.sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0))
          .slice(0, 5) || [];

        // Buscar informações das conversas para obter o nome do cliente
        const conversationIds = [...new Set(
          sortedTickets
            .map((t: any) => t.conversationId as string | undefined)
            .filter((id: string | undefined): id is string => typeof id === 'string' && id.length > 0)
        )] as string[];
        
        type ConversationResult = {
          conversationId: string;
          conversation: any;
        };
        
        const conversationPromises = conversationIds.map(async (convId): Promise<ConversationResult | null> => {
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

        const conversationResults = await Promise.all(conversationPromises);
        const conversationsMap: Record<string, any> = {};
        conversationResults.forEach((result) => {
          if (result !== null) {
            conversationsMap[result.conversationId] = result.conversation;
          }
        });

        setRecentTickets(
          sortedTickets.map((t: any) => {
            const conversation = conversationsMap[t.conversationId];
            const customerName = conversation?.sender?.pushName || conversation?.sender?.phoneNumber || 'Cliente';
            return {
              id: t.id,
              conversationId: t.conversationId,
              customerName,
              reason: t.reason || t.title || 'Sem assunto',
              status: t.status,
              createdAt: t.createdAt || Date.now(),
            };
          })
        );

        setStats({
          conversations: conversations.data?.length || 0,
          tickets: tickets.data?.length || 0,
          openTickets,
          resolvedTickets,
        });
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 30000); // Atualizar a cada 30s

    return () => clearInterval(interval);
  }, [token]);

  if (loading) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="flex justify-center items-center h-64">
            <div className="text-slate-500">Carregando...</div>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    );
  }

  // Calcular altura máxima do gráfico
  const maxValue = Math.max(...chartData.map(d => d.atendimentos));
  const chartHeight = 200;

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="min-h-screen bg-slate-50/50 p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="mb-6">
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">Dashboard</h1>
              <p className="text-sm text-slate-500 mt-1">Visão geral do sistema</p>
            </div>

            {/* Cards de KPI */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* Card: Conversas */}
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm font-medium text-slate-500">Conversas</p>
                    <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                      <MessageSquare className="w-5 h-5 text-blue-600" />
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-slate-900">
                    {stats?.conversations || 0}
                  </p>
                </div>
              </div>

              {/* Card: Total de Tickets */}
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm font-medium text-slate-500">Total de Tickets</p>
                    <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                      <Ticket className="w-5 h-5 text-purple-600" />
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-slate-900">
                    {stats?.tickets || 0}
                  </p>
                </div>
              </div>

              {/* Card: Tickets Abertos */}
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm font-medium text-slate-500">Tickets Abertos</p>
                    <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                      <Clock className="w-5 h-5 text-amber-600" />
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-amber-600">
                    {stats?.openTickets || 0}
                  </p>
                </div>
              </div>

              {/* Card: Tickets Resolvidos */}
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm font-medium text-slate-500">Tickets Resolvidos</p>
                    <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-green-600">
                    {stats?.resolvedTickets || 0}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">Últimos 7 dias</p>
                </div>
              </div>
            </div>

            {/* Grid Principal: Gráfico + Tickets Recentes */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Seção: Visão Geral (Gráfico) - 2/3 */}
              <div className="md:col-span-2 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="px-6 pt-5 pb-4 border-b border-slate-200">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">Visão Geral da Semana</h3>
                      <p className="text-sm text-slate-500 mt-0.5">Volume de atendimentos</p>
                    </div>
                    <TrendingUp className="w-5 h-5 text-slate-400" />
                  </div>
                  
                  {/* Estatísticas Resumidas */}
                  {(() => {
                    const stats = calculateChartStats(chartData);
                    return (
                      <div className="grid grid-cols-3 gap-4">
                        <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                          <p className="text-xs text-slate-500 mb-1">Total da Semana</p>
                          <p className="text-lg font-bold text-slate-900">{stats.total}</p>
                        </div>
                        <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                          <p className="text-xs text-slate-500 mb-1">Média Diária</p>
                          <p className="text-lg font-bold text-slate-900">{stats.average}</p>
                        </div>
                        <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                          <p className="text-xs text-slate-500 mb-1">Pico da Semana</p>
                          <p className="text-lg font-bold text-blue-600">{stats.max}</p>
                        </div>
                      </div>
                    );
                  })()}
                </div>
                
                <div className="p-6">
                  {/* Gráfico de Barras */}
                  <div className="mb-4">
                    <div className="flex items-end justify-between gap-3 h-[220px]">
                      {chartData.map((data, index) => {
                        const height = (data.atendimentos / maxValue) * 200;
                        const isToday = index === new Date().getDay(); // Destacar o dia atual
                        return (
                          <div key={index} className="flex-1 flex flex-col items-center gap-2 group">
                            <div className="relative w-full flex items-end justify-center" style={{ height: '200px' }}>
                              <div
                                className={`w-full rounded-t-lg transition-all cursor-pointer relative ${
                                  isToday 
                                    ? 'bg-gradient-to-t from-blue-600 to-blue-500 ring-2 ring-blue-300 ring-offset-2' 
                                    : 'bg-gradient-to-t from-blue-500 to-blue-400 hover:from-blue-600 hover:to-blue-500'
                                }`}
                                style={{
                                  height: `${height}px`,
                                  minHeight: '4px',
                                }}
                                title={`${data.day}: ${data.atendimentos} atendimentos`}
                              >
                                {/* Tooltip no hover */}
                                <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap pointer-events-none z-10">
                                  {data.atendimentos} atendimentos
                                  <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-900"></div>
                                </div>
                              </div>
                            </div>
                            <div className={`text-xs font-medium ${isToday ? 'text-blue-600 font-semibold' : 'text-slate-600'}`}>
                              {data.day}
                            </div>
                            <div className={`text-xs font-semibold ${isToday ? 'text-blue-600' : 'text-slate-400'}`}>
                              {data.atendimentos}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  
                  {/* Legenda */}
                  <div className="flex items-center justify-center gap-6 pt-4 border-t border-slate-100">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded bg-blue-500"></div>
                      <span className="text-xs text-slate-600">Atendimentos</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded bg-blue-600 ring-2 ring-blue-300"></div>
                      <span className="text-xs text-slate-600">Hoje</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Seção: Tickets Recentes - 1/3 */}
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">Tickets Recentes</h3>
                      <p className="text-sm text-slate-500 mt-1">Últimas atividades</p>
                    </div>
                  </div>
                </div>
                <div className="p-4">
                  {recentTickets.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-sm text-slate-500">Nenhum ticket recente</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {recentTickets.map((ticket) => (
                        <Link
                          key={ticket.id}
                          href={`/tickets/${ticket.id}`}
                          className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors group"
                        >
                          {/* Avatar */}
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center flex-shrink-0 text-white text-xs font-semibold">
                            {getInitials(ticket.customerName)}
                          </div>
                          {/* Conteúdo */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-900 truncate group-hover:text-blue-600 transition-colors">
                              {ticket.customerName}
                            </p>
                            <p className="text-xs text-slate-500 truncate">{ticket.reason}</p>
                            <p className="text-xs text-slate-400 mt-0.5">
                              {formatTimeAgo(ticket.createdAt)}
                            </p>
                          </div>
                          {/* Status Badge */}
                          <div className="flex-shrink-0">
                            {ticket.status === 'open' && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                                Aberto
                              </span>
                            )}
                            {ticket.status === 'in_progress' && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                                Em Progresso
                              </span>
                            )}
                            {ticket.status === 'closed' && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                Fechado
                              </span>
                            )}
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                  {recentTickets.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-slate-200">
                      <Link
                        href="/tickets"
                        className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center justify-center"
                      >
                        Ver todos os tickets →
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
