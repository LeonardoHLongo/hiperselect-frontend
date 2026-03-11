import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { 
  Store, 
  Building2, 
  MapPin, 
  Phone, 
  Clock, 
  Plus, 
  Edit, 
  Trash2,
  FileText,
  CheckCircle2,
  XCircle,
  X
} from 'lucide-react';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import { ProtectedRoute } from '../../components/ProtectedRoute';
import { useAuth } from '../../contexts/AuthContext';

type Store = {
  id: string;
  name: string;
  address: string;
  neighborhood: string;
  city: string;
  openingHours: string;
  phone: string;
  isActive: boolean;
  managerWhatsappNumber?: string | null;
  managerWhatsappEnabled?: boolean;
  googleReviewLink?: string | null;
  createdAt: number;
  updatedAt: number;
};

type Policy = {
  id: string;
  title: string;
  content: string;
  applicableStores: string[];
  createdAt: number;
  updatedAt: number;
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function StoresPage() {
  const { token } = useAuth();
  const [stores, setStores] = useState<Store[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'stores' | 'policies'>('stores');
  const [showStoreForm, setShowStoreForm] = useState(false);
  const [showPolicyForm, setShowPolicyForm] = useState(false);
  const [editingStore, setEditingStore] = useState<Store | null>(null);
  const [editingPolicy, setEditingPolicy] = useState<Policy | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

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

  // Store form state
  const [storeForm, setStoreForm] = useState({
    name: '',
    address: '',
    neighborhood: '',
    city: '',
    openingHours: '',
    phone: '',
    isActive: true,
    managerWhatsappNumber: '',
    managerWhatsappEnabled: false,
    googleReviewLink: '',
  });

  // Estado para múltiplos telefones (apenas visual, backend ainda usa apenas o primeiro)
  const [storeWhatsappNumbers, setStoreWhatsappNumbers] = useState<string[]>(['']);

  // Policy form state
  const [policyForm, setPolicyForm] = useState({
    title: '',
    content: '',
    applicableStores: [] as string[],
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    if (!token) return; // Não fazer requisição se não houver token
    try {
      const [storesRes, policiesRes] = await Promise.all([
        fetchWithAuth(`${API_BASE}/api/v1/stores`),
        fetchWithAuth(`${API_BASE}/api/v1/policies`),
      ]);

      const storesData = await storesRes.json();
      const policiesData = await policiesRes.json();

      if (storesData.success) {
        setStores(storesData.data || []);
      }
      if (policiesData.success) {
        setPolicies(policiesData.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStoreSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingStore
        ? `${API_BASE}/api/v1/stores/${editingStore.id}`
        : `${API_BASE}/api/v1/stores`;
      const method = editingStore ? 'PUT' : 'POST';

      const payload: any = { ...storeForm };
      // Garantir que googleReviewLink seja enviado mesmo se vazio (será null no backend)
      if (payload.googleReviewLink === '') {
        payload.googleReviewLink = null;
      }
      
      const response = await fetchWithAuth(url, {
        method,
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (data.success) {
        await fetchData();
        setShowStoreForm(false);
        setEditingStore(null);
        setStoreForm({
          name: '',
          address: '',
          neighborhood: '',
          city: '',
          openingHours: '',
          phone: '',
          isActive: true,
          managerWhatsappNumber: '',
          managerWhatsappEnabled: false,
          googleReviewLink: '',
        });
        setStoreWhatsappNumbers(['']);
      } else {
        alert(`Erro: ${data.message}`);
      }
    } catch (error) {
      console.error('Error saving store:', error);
      alert('Erro ao salvar loja');
    }
  };

  const handlePolicySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingPolicy
        ? `${API_BASE}/api/v1/policies/${editingPolicy.id}`
        : `${API_BASE}/api/v1/policies`;
      const method = editingPolicy ? 'PUT' : 'POST';

      const response = await fetchWithAuth(url, {
        method,
        body: JSON.stringify(policyForm),
      });

      const data = await response.json();
      if (data.success) {
        await fetchData();
        setShowPolicyForm(false);
        setEditingPolicy(null);
        setPolicyForm({
          title: '',
          content: '',
          applicableStores: [],
        });
      } else {
        alert(`Erro: ${data.message}`);
      }
    } catch (error) {
      console.error('Error saving policy:', error);
      alert('Erro ao salvar política');
    }
  };

  const handleDeleteStore = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta loja?')) return;

    try {
      const response = await fetchWithAuth(`${API_BASE}/api/v1/stores/${id}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      if (data.success) {
        await fetchData();
      } else {
        alert(`Erro: ${data.message}`);
      }
    } catch (error) {
      console.error('Error deleting store:', error);
      alert('Erro ao excluir loja');
    }
  };

  const handleDeletePolicy = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta política?')) return;

    try {
      const response = await fetchWithAuth(`${API_BASE}/api/v1/policies/${id}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      if (data.success) {
        await fetchData();
      } else {
        alert(`Erro: ${data.message}`);
      }
    } catch (error) {
      console.error('Error deleting policy:', error);
      alert('Erro ao excluir política');
    }
  };

  const handleEditStore = (store: Store) => {
    setEditingStore(store);
    setStoreForm({
      name: store.name,
      address: store.address,
      neighborhood: store.neighborhood,
      city: store.city,
      openingHours: store.openingHours,
      phone: store.phone,
      isActive: store.isActive,
      managerWhatsappNumber: store.managerWhatsappNumber || '',
      managerWhatsappEnabled: store.managerWhatsappEnabled || false,
      googleReviewLink: store.googleReviewLink || '',
    });
    // Inicializar lista de telefones (se houver, usar o primeiro; senão, array vazio)
    setStoreWhatsappNumbers(store.managerWhatsappNumber ? [store.managerWhatsappNumber] : ['']);
    setShowStoreForm(true);
    
    // Scroll suave para o formulário após um pequeno delay
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const handleCloseStoreForm = () => {
    setShowStoreForm(false);
    setEditingStore(null);
    setStoreForm({
      name: '',
      address: '',
      neighborhood: '',
      city: '',
      openingHours: '',
      phone: '',
      isActive: true,
      managerWhatsappNumber: '',
      managerWhatsappEnabled: false,
      googleReviewLink: '',
    });
    setStoreWhatsappNumbers(['']);
  };

  const handleNewStore = () => {
    setEditingStore(null);
    setStoreForm({
      name: '',
      address: '',
      neighborhood: '',
      city: '',
      openingHours: '',
      phone: '',
      isActive: true,
      managerWhatsappNumber: '',
      managerWhatsappEnabled: false,
      googleReviewLink: '',
    });
    setShowStoreForm(true);
    
    // Scroll suave para o formulário após um pequeno delay
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const handleEditPolicy = (policy: Policy) => {
    setEditingPolicy(policy);
    setPolicyForm({
      title: policy.title,
      content: policy.content,
      applicableStores: policy.applicableStores,
    });
    setShowPolicyForm(true);
  };

  // Calcular se a loja está aberta baseado no horário
  const isStoreOpen = (openingHours: string): { isOpen: boolean; status: string } => {
    // Parse simples do horário (ex: "Seg-Sex: 8h-18h" ou "8h-18h")
    try {
      const now = new Date();
      const currentHour = now.getHours();
      const currentDay = now.getDay(); // 0 = Domingo, 6 = Sábado
      
      // Extrair horários do formato "8h-18h" ou "08:00-18:00"
      const timeMatch = openingHours.match(/(\d{1,2})[h:](\d{0,2})\s*-\s*(\d{1,2})[h:](\d{0,2})/);
      
      if (timeMatch) {
        const openHour = parseInt(timeMatch[1]);
        const closeHour = parseInt(timeMatch[3]);
        
        if (currentHour >= openHour && currentHour < closeHour) {
          return { isOpen: true, status: 'Aberto' };
        }
      }
      
      // Se não conseguir parsear, retorna baseado em isActive
      return { isOpen: false, status: 'Fechado' };
    } catch {
      return { isOpen: false, status: 'Fechado' };
    }
  };

  // Obter cor do card baseado no índice (para diferenciação visual)
  const getStoreCardColor = (index: number) => {
    const colors = [
      { bg: 'bg-green-100', text: 'text-green-600' },
      { bg: 'bg-green-100', text: 'text-green-600' },
      { bg: 'bg-purple-100', text: 'text-purple-600' },
      { bg: 'bg-orange-100', text: 'text-orange-600' },
      { bg: 'bg-pink-100', text: 'text-pink-600' },
      { bg: 'bg-indigo-100', text: 'text-indigo-600' },
    ];
    return colors[index % colors.length];
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
          {/* Header com Abas Modernas */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Configurações Operacionais
              </h1>
              
              {/* Botão de Ação Primária */}
              {activeTab === 'stores' && (
                <button
                  onClick={handleNewStore}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium shadow-sm hover:shadow-md"
                >
                  <Plus className="w-4 h-4" />
                  Nova Loja
                </button>
              )}
              
              {activeTab === 'policies' && (
                <button
                  onClick={() => {
                    setEditingPolicy(null);
                    setPolicyForm({
                      title: '',
                      content: '',
                      applicableStores: [],
                    });
                    setShowPolicyForm(true);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium shadow-sm hover:shadow-md"
                >
                  <Plus className="w-4 h-4" />
                  Nova Política
                </button>
              )}
            </div>

            {/* Tabs Modernas */}
            <div className="border-b border-slate-200">
              <nav className="flex space-x-8">
                <button
                  onClick={() => setActiveTab('stores')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === 'stores'
                      ? 'border-green-600 text-green-600'
                      : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                  }`}
                >
                  Lojas ({stores.length})
                </button>
                <button
                  onClick={() => setActiveTab('policies')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === 'policies'
                      ? 'border-green-600 text-green-600'
                      : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                  }`}
                >
                  Políticas ({policies.length})
                </button>
              </nav>
            </div>
          </div>

          {/* Stores Tab */}
          {activeTab === 'stores' && (
            <div>

            {showStoreForm && (
              <div 
                ref={formRef}
                className="bg-white border border-slate-200 rounded-xl shadow-sm p-8 mb-6"
              >
                {/* Header do Formulário */}
                <div className="flex items-center justify-between mb-8 pb-6 border-b border-slate-100">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                      <Building2 className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-slate-900">
                        {editingStore ? `Editando Unidade: ${editingStore.name}` : 'Nova Loja'}
                      </h3>
                      {editingStore && (
                        <p className="text-sm text-slate-500 mt-0.5">
                          {editingStore.address}, {editingStore.city}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  {/* Botão Fechar */}
                  <button
                    onClick={handleCloseStoreForm}
                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                    title="Fechar formulário"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleStoreSubmit} className="space-y-8">
                  {/* Seção: Dados da Unidade */}
                  <div className="space-y-6">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900 mb-4">Dados da Unidade</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-slate-700">
                            Nome da Loja <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            value={storeForm.name}
                            onChange={(e) => setStoreForm({ ...storeForm, name: e.target.value })}
                            className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                            placeholder="Ex: Loja Centro"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-slate-700">
                            Cidade <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            value={storeForm.city}
                            onChange={(e) => setStoreForm({ ...storeForm, city: e.target.value })}
                            className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                            placeholder="Ex: Florianópolis"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-slate-700">
                            Endereço <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            value={storeForm.address}
                            onChange={(e) => setStoreForm({ ...storeForm, address: e.target.value })}
                            className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                            placeholder="Ex: Rua das Flores, 123"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-slate-700">
                            Bairro <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            value={storeForm.neighborhood}
                            onChange={(e) => setStoreForm({ ...storeForm, neighborhood: e.target.value })}
                            className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                            placeholder="Ex: Centro"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Seção: Contato e Horário */}
                  <div className="space-y-6 pt-6 border-t border-slate-100">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900 mb-4">Contato e Horário</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-slate-700">
                            Telefone <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            value={storeForm.phone}
                            onChange={(e) => setStoreForm({ ...storeForm, phone: e.target.value })}
                            className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                            placeholder="Ex: (48) 99999-9999"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-slate-700">
                            Horário de Funcionamento <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            value={storeForm.openingHours}
                            onChange={(e) => setStoreForm({ ...storeForm, openingHours: e.target.value })}
                            className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                            placeholder="Ex: Seg-Sex: 8h-18h, Sáb: 9h-13h"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Seção: Configurações do Gerente */}
                  <div className="space-y-6 pt-6 border-t border-slate-100">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900 mb-4">Configurações do Gerente</h4>
                      <p className="text-xs text-slate-500 mb-4">Configurações opcionais para notificações automáticas</p>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-slate-700">
                            WhatsApp da Loja
                          </label>
                          <div className="space-y-2">
                            {storeWhatsappNumbers.map((number, index) => (
                              <div key={index} className="flex items-center gap-2">
                                <input
                                  type="text"
                                  value={number}
                                  onChange={(e) => {
                                    const newNumbers = [...storeWhatsappNumbers];
                                    newNumbers[index] = e.target.value;
                                    setStoreWhatsappNumbers(newNumbers);
                                    // Atualizar o primeiro número no form para o backend
                                    setStoreForm({ ...storeForm, managerWhatsappNumber: newNumbers[0] || '' });
                                  }}
                                  className="flex-1 px-3 py-2.5 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                                  placeholder="Ex: 5548999999999"
                                />
                                {storeWhatsappNumbers.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const newNumbers = storeWhatsappNumbers.filter((_, i) => i !== index);
                                      setStoreWhatsappNumbers(newNumbers);
                                      // Atualizar o primeiro número no form para o backend
                                      setStoreForm({ ...storeForm, managerWhatsappNumber: newNumbers[0] || '' });
                                    }}
                                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Remover telefone"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            ))}
                            <button
                              type="button"
                              onClick={() => {
                                setStoreWhatsappNumbers([...storeWhatsappNumbers, '']);
                              }}
                              className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-colors border border-slate-200"
                            >
                              <Plus className="w-4 h-4" />
                              Adicionar outro telefone
                            </button>
                          </div>
                          <p className="text-xs text-slate-500 mt-1.5">
                            Números que receberão mensagens automáticas do sistema. (Apenas o primeiro será usado pelo backend por enquanto)
                          </p>
                        </div>
                        <div className="flex items-start gap-3 pt-2">
                          <input
                            type="checkbox"
                            id="managerWhatsappEnabled"
                            checked={storeForm.managerWhatsappEnabled}
                            onChange={(e) => setStoreForm({ ...storeForm, managerWhatsappEnabled: e.target.checked })}
                            className="mt-0.5 w-4 h-4 rounded border-slate-300 text-green-600 focus:ring-2 focus:ring-green-500 focus:ring-offset-0"
                          />
                          <label htmlFor="managerWhatsappEnabled" className="text-sm text-slate-700 cursor-pointer">
                            Permitir verificação automática com gerente
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Seção: Gestão de Reputação */}
                  <div className="space-y-6 pt-6 border-t border-slate-100">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900 mb-4">Gestão de Reputação</h4>
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-slate-700">
                          Link do Google Meu Negócio
                        </label>
                        <input
                          type="url"
                          value={storeForm.googleReviewLink || ''}
                          onChange={(e) => setStoreForm({ ...storeForm, googleReviewLink: e.target.value })}
                          className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                          placeholder="https://g.page/r/..."
                        />
                        <p className="text-xs text-slate-500 mt-1.5">
                          Link direto para a página de avaliação do Google Meu Negócio desta unidade. Será enviado automaticamente quando clientes deixarem feedback positivo.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Seção: Status da Loja */}
                  <div className="pt-6 border-t border-slate-100">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        id="isActive"
                        checked={storeForm.isActive}
                        onChange={(e) => setStoreForm({ ...storeForm, isActive: e.target.checked })}
                        className="mt-0.5 w-4 h-4 rounded border-slate-300 text-green-600 focus:ring-2 focus:ring-green-500 focus:ring-offset-0"
                      />
                      <label htmlFor="isActive" className="text-sm font-medium text-slate-700 cursor-pointer">
                        Loja ativa
                      </label>
                    </div>
                    <p className="text-xs text-slate-500 mt-1.5 ml-7">
                      Lojas inativas não aparecerão nas seleções e não receberão novos pedidos.
                    </p>
                  </div>

                  {/* Área de Ações */}
                  <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={handleCloseStoreForm}
                      className="px-6 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors shadow-sm hover:shadow-md"
                    >
                      {editingStore ? 'Atualizar Loja' : 'Criar Loja'}
                    </button>
                  </div>
                </form>
              </div>
            )}

              {/* Grid de Lojas */}
              {stores.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-12 text-center">
                  <Store className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500 font-medium">Nenhuma loja cadastrada</p>
                  <p className="text-sm text-slate-400 mt-1">Comece adicionando sua primeira loja</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {stores.map((store, index) => {
                    const cardColor = getStoreCardColor(index);
                    const storeStatus = isStoreOpen(store.openingHours);
                    
                    const isBeingEdited = editingStore?.id === store.id;
                    const isEditingMode = editingStore !== null;
                    
                    return (
                      <div
                        key={store.id}
                        className={`h-full flex flex-col rounded-xl shadow-sm hover:shadow-md transition-all overflow-hidden ${
                          isBeingEdited
                            ? 'bg-green-100/60 border-green-600 border-2 ring-4 ring-green-300 shadow-xl'
                            : isEditingMode
                            ? 'bg-white border border-slate-200 opacity-60'
                            : 'bg-white border border-slate-200'
                        }`}
                      >
                        {/* Cabeçalho do Card */}
                        <div className="p-5 border-b border-slate-100 flex-shrink-0">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`w-12 h-12 rounded-full ${cardColor.bg} flex items-center justify-center flex-shrink-0`}>
                                <Building2 className={`w-6 h-6 ${cardColor.text}`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h3 className="text-base font-bold text-slate-900 truncate">
                                  {store.name}
                                </h3>
                                {!store.isActive && (
                                  <span className="inline-flex items-center px-2 py-0.5 mt-1 text-xs font-medium bg-slate-100 text-slate-600 rounded-full">
                                    Inativa
                                  </span>
                                )}
                              </div>
                            </div>
                            
                            {/* Menu de Ações */}
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleEditStore(store)}
                                className="p-1.5 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                                title="Editar"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteStore(store.id)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                title="Excluir"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Corpo do Card - Flex-1 para esticar */}
                        <div className="flex-1 p-5 space-y-3 flex flex-col">
                          {/* Endereço */}
                          <div className="flex items-start gap-2">
                            <MapPin className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                            <p className="text-sm text-slate-600 line-clamp-2">
                              {store.address}, {store.neighborhood} - {store.city}
                            </p>
                          </div>

                          {/* Telefone */}
                          <div className="flex items-center gap-2">
                            <Phone className="w-4 h-4 text-slate-400 flex-shrink-0" />
                            <p className="text-sm text-slate-600">{store.phone}</p>
                          </div>

                          {/* Horário e Status */}
                          <div className="flex items-center justify-between pt-2 border-t border-slate-100 mt-auto">
                            <div className="flex items-center gap-2">
                              <Clock className="w-4 h-4 text-slate-400" />
                              <p className="text-xs text-slate-500">{store.openingHours}</p>
                            </div>
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                              storeStatus.isOpen && store.isActive
                                ? 'bg-green-100 text-green-700'
                                : 'bg-blue-100 text-blue-700'
                            }`}>
                              {storeStatus.isOpen && store.isActive ? (
                                <>
                                  <CheckCircle2 className="w-3 h-3" />
                                  Aberto
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 className="w-3 h-3" />
                                  Aberto
                                </>
                              )}
                            </span>
                          </div>
                        </div>

                        {/* Rodapé do Card - Fixo no final */}
                        <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex-shrink-0">
                          <button
                            onClick={() => handleEditStore(store)}
                            className="w-full px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                          >
                            Editar
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Policies Tab */}
          {activeTab === 'policies' && (
            <div>

            {showPolicyForm && (
              <div className="bg-white shadow rounded-lg p-6 mb-6">
                <h3 className="text-lg font-medium mb-4">
                  {editingPolicy ? 'Editar Política' : 'Nova Política'}
                </h3>
                <form onSubmit={handlePolicySubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Título *</label>
                    <input
                      type="text"
                      required
                      value={policyForm.title}
                      onChange={(e) => setPolicyForm({ ...policyForm, title: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Conteúdo *</label>
                    <textarea
                      required
                      rows={6}
                      value={policyForm.content}
                      onChange={(e) => setPolicyForm({ ...policyForm, content: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Lojas Aplicáveis (deixe vazio para aplicar a todas)
                    </label>
                    <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-300 rounded-md p-2">
                      {stores.map((store) => (
                        <label key={store.id} className="flex items-center">
                          <input
                            type="checkbox"
                            checked={policyForm.applicableStores.includes(store.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setPolicyForm({
                                  ...policyForm,
                                  applicableStores: [...policyForm.applicableStores, store.id],
                                });
                              } else {
                                setPolicyForm({
                                  ...policyForm,
                                  applicableStores: policyForm.applicableStores.filter((id) => id !== store.id),
                                });
                              }
                            }}
                            className="rounded border-gray-300"
                          />
                          <span className="ml-2 text-sm text-gray-700">{store.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      type="submit"
                      className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
                    >
                      {editingPolicy ? 'Atualizar' : 'Criar'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowPolicyForm(false);
                        setEditingPolicy(null);
                      }}
                      className="bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              </div>
            )}

              {/* Lista Rica de Políticas */}
              {policies.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-12 text-center">
                  <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500 font-medium">Nenhuma política cadastrada</p>
                  <p className="text-sm text-slate-400 mt-1">Comece criando sua primeira política</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {policies.map((policy) => {
                    const applicableStoresNames =
                      policy.applicableStores.length === 0
                        ? 'Todas as lojas'
                        : stores
                            .filter((s) => policy.applicableStores.includes(s.id))
                            .map((s) => s.name)
                            .join(', ');

                    return (
                      <div
                        key={policy.id}
                        className="bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md transition-all p-6"
                      >
                        <div className="flex items-start gap-4">
                          {/* Ícone */}
                          <div className="flex-shrink-0">
                            <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center">
                              <FileText className="w-6 h-6 text-purple-600" />
                            </div>
                          </div>

                          {/* Conteúdo */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between mb-2">
                              <h3 className="text-lg font-semibold text-slate-900">
                                {policy.title}
                              </h3>
                              <div className="flex items-center gap-2 ml-4">
                                <button
                                  onClick={() => handleEditPolicy(policy)}
                                  className="p-1.5 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                                  title="Editar"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeletePolicy(policy.id)}
                                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                  title="Excluir"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                            
                            {/* Preview do conteúdo */}
                            <p className="text-sm text-slate-600 line-clamp-3 mb-3">
                              {policy.content}
                            </p>
                            
                            {/* Badges de lojas aplicáveis */}
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs text-slate-500 font-medium">Aplicável a:</span>
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                                policy.applicableStores.length === 0
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-slate-100 text-slate-700'
                              }`}>
                                {applicableStoresNames}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}

