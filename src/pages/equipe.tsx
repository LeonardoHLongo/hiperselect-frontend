import { useState, useEffect } from 'react';
import { Plus, Users, Shield, User, Trash2 } from 'lucide-react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { useAuth } from '../contexts/AuthContext';

type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'agent';
  created_at: string;
  color?: string;
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function EquipePage() {
  const { token, user } = useAuth();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'agent' as 'admin' | 'agent',
    color: '#3B82F6', // Azul padrão
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Verificar se é admin
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    if (!isAdmin) {
      // Redirecionar se não for admin
      return;
    }
    fetchMembers();
  }, [token, isAdmin]);

  const fetchMembers = async () => {
    if (!token) return;
    
    try {
      const response = await fetch(`${API_BASE}/api/v1/team`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      
      if (data.success) {
        setMembers(data.data || []);
      } else {
        console.error('Erro ao buscar membros:', data.message);
        setError(data.message || 'Erro ao buscar membros');
      }
    } catch (err) {
      console.error('Erro ao buscar membros:', err);
      setError('Erro ao buscar membros da equipe');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    if (!token) return;

    try {
      const response = await fetch(`${API_BASE}/api/v1/team`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (data.success) {
        setShowAddModal(false);
        setFormData({
          name: '',
          email: '',
          password: '',
          role: 'agent',
          color: '#3B82F6',
        });
        await fetchMembers();
      } else {
        setError(data.message || 'Erro ao adicionar membro');
      }
    } catch (err) {
      console.error('Erro ao adicionar membro:', err);
      setError('Erro ao adicionar membro');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (memberId: string) => {
    if (!token) return;
    if (!confirm('Tem certeza que deseja remover este membro?')) return;

    try {
      const response = await fetch(`${API_BASE}/api/v1/team/${memberId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (data.success) {
        await fetchMembers();
      } else {
        alert(data.message || 'Erro ao remover membro');
      }
    } catch (err) {
      console.error('Erro ao remover membro:', err);
      alert('Erro ao remover membro');
    }
  };

  if (!isAdmin) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="p-6">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800">Acesso negado. Apenas administradores podem acessar esta página.</p>
            </div>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Users className="w-6 h-6" />
                Gerenciar Equipe
              </h1>
              <p className="text-gray-600 mt-1">Gerencie os membros da sua equipe</p>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Adicionar Membro
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <p className="text-red-800">{error}</p>
            </div>
          )}

          {loading ? (
            <div className="text-center py-12">
              <p className="text-gray-600">Carregando membros...</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Nome
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Função
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Data de Criação
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {members.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                        Nenhum membro encontrado
                      </td>
                    </tr>
                  ) : (
                    members.map((member) => (
                      <tr key={member.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            {member.role === 'admin' ? (
                              <Shield className="w-4 h-4 text-purple-600 mr-2" />
                            ) : (
                              <User className="w-4 h-4 text-blue-600 mr-2" />
                            )}
                            <span className="text-sm font-medium text-gray-900">{member.name}</span>
                            {member.id === user?.id && (
                              <span className="ml-2 px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded">
                                Você
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {member.email}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-1 text-xs font-medium rounded ${
                              member.role === 'admin'
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {member.role === 'admin' ? 'Administrador' : 'Atendente'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={member.color || '#3B82F6'}
                              onChange={async (e) => {
                                // Atualizar cor do agente
                                try {
                                  const response = await fetch(`${API_BASE}/api/v1/team/${member.id}/color`, {
                                    method: 'PATCH',
                                    headers: {
                                      'Authorization': `Bearer ${token}`,
                                      'Content-Type': 'application/json',
                                    },
                                    body: JSON.stringify({ color: e.target.value }),
                                  });
                                  
                                  const data = await response.json();
                                  if (data.success) {
                                    await fetchMembers();
                                  } else {
                                    alert(data.message || 'Erro ao atualizar cor');
                                  }
                                } catch (err) {
                                  console.error('Erro ao atualizar cor:', err);
                                  alert('Erro ao atualizar cor do agente');
                                }
                              }}
                              className="w-8 h-8 rounded border border-gray-300 cursor-pointer"
                              title="Clique para alterar a cor"
                            />
                            <span className="text-xs text-gray-500 font-mono">{member.color || '#3B82F6'}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(member.created_at).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          {member.id !== user?.id && (
                            <button
                              onClick={() => handleDelete(member.id)}
                              className="text-red-600 hover:text-red-900"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Modal de Adicionar Membro */}
          {showAddModal && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Adicionar Membro</h2>
                
                <form onSubmit={handleSubmit}>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Nome
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        placeholder="Nome completo"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Email
                      </label>
                      <input
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        placeholder="email@exemplo.com"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Senha
                      </label>
                      <input
                        type="password"
                        required
                        minLength={6}
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        placeholder="Mínimo 6 caracteres"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Função
                      </label>
                      <select
                        value={formData.role}
                        onChange={(e) => setFormData({ ...formData, role: e.target.value as 'admin' | 'agent' })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      >
                        <option value="agent">Atendente</option>
                        <option value="admin">Administrador</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Cor do Agente
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          value={formData.color}
                          onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                          className="w-16 h-10 rounded border border-gray-300 cursor-pointer"
                        />
                        <input
                          type="text"
                          value={formData.color}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
                              setFormData({ ...formData, color: value });
                            }
                          }}
                          placeholder="#3B82F6"
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent font-mono text-sm"
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Cor usada para identificar o agente nos badges</p>
                    </div>
                  </div>

                  <div className="flex gap-3 mt-6">
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddModal(false);
                        setError(null);
                        setFormData({
                          name: '',
                          email: '',
                          password: '',
                          role: 'agent',
                          color: '#3B82F6',
                        });
                      }}
                      className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {submitting ? 'Adicionando...' : 'Adicionar'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
