import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { 
  LayoutDashboard, 
  MessageSquare, 
  Ticket, 
  Store, 
  Settings, 
  Bell,
  LogOut,
  User,
  ArrowLeft,
  Users
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { useTicketsCount } from '../hooks/useTicketsCount';
import { NotificationModal } from '../components/NotificationModal';
import { WhatsAppStatusAlert } from '../components/WhatsAppStatusAlert';

type MainLayoutProps = {
  children: React.ReactNode;
};

type NavItem = {
  href: string;
  label: string;
  icon: React.ElementType;
  badge?: number;
  badgeColor?: 'red' | 'blue';
};

export const MainLayout = ({ children }: MainLayoutProps) => {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { unreadCount, handoffCount } = useNotifications();
  const { count: ticketsCount } = useTicketsCount();
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false);

  const isActive = (path: string): boolean => {
    if (path === '/') {
      return router.pathname === '/';
    }
    return router.pathname.startsWith(path);
  };

  // Verificar se está em uma página de detalhes (com parâmetros dinâmicos)
  const isDetailPage = router.pathname.includes('/[') || router.pathname.split('/').length > 2;
  
  // Obter a rota base para voltar (ex: /conversations/[id] -> /conversations)
  const getBackPath = (): string => {
    const pathParts = router.pathname.split('/').filter(Boolean);
    if (pathParts.length > 1) {
      // Remove o último segmento (que é o parâmetro dinâmico)
      return '/' + pathParts.slice(0, -1).join('/');
    }
    // Se não conseguir determinar, volta para a página anterior
    return '/';
  };

  const handleBack = () => {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push(getBackPath());
    }
  };

  const navItems: NavItem[] = [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/conversations', label: 'Conversations', icon: MessageSquare },
    { 
      href: '/tickets', 
      label: 'Tickets', 
      icon: Ticket,
      badge: ticketsCount > 0 ? ticketsCount : undefined,
      badgeColor: 'red'
    },
    { href: '/stores', label: 'Lojas', icon: Store },
    ...(user?.role === 'admin' ? [{ href: '/equipe', label: 'Equipe', icon: Users }] : []),
    { href: '/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-zinc-50/50 flex">
      {/* Sidebar */}
      <aside className="w-[260px] bg-slate-900 flex flex-col fixed h-screen z-50">
        {/* Logo */}
        <div className="h-16 flex items-center px-6 border-b border-slate-800">
          <h1 className="text-xl font-bold text-white">Hiperselect</h1>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
                  ${active 
                    ? 'bg-white/10 text-white' 
                    : 'text-slate-300 hover:bg-white/5 hover:text-white'
                  }
                `}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span className="flex-1">{item.label}</span>
                {item.badge && item.badge > 0 && (
                  <span className={`
                    inline-flex items-center justify-center min-w-[1.5rem] h-5 px-1.5 text-xs font-bold 
                    rounded-full text-white
                    ${item.badgeColor === 'red' ? 'bg-red-600' : 'bg-green-600'}
                  `}>
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User Profile & Actions */}
        <div className="px-3 py-4 border-t border-slate-800 space-y-2">
          {/* Notifications Button */}
          <button
            onClick={() => setIsNotificationModalOpen(true)}
            className="relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-300 hover:bg-white/5 hover:text-white transition-all"
            title={unreadCount > 0 ? `${unreadCount} notificação${unreadCount > 1 ? 'ões' : ''} não lida${unreadCount > 1 ? 's' : ''}` : 'Nenhuma notificação'}
          >
            <Bell className="w-5 h-5 flex-shrink-0" />
            <span className="flex-1 text-left">Notificações</span>
            {unreadCount > 0 && (
              <span className={`
                inline-flex items-center justify-center min-w-[1.5rem] h-5 px-1.5 text-xs font-bold 
                rounded-full text-white
                ${handoffCount > 0 ? 'bg-red-600' : 'bg-green-600'}
              `}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {/* User Info */}
          {user && (
            <div className="flex items-center gap-3 px-3 py-2.5 text-slate-300">
              <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4" />
              </div>
              <span className="flex-1 text-sm font-medium truncate">{user.name}</span>
            </div>
          )}

          {/* Logout Button */}
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-300 hover:bg-white/5 hover:text-white transition-all"
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            <span>Sair</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 ml-[260px] flex flex-col">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-zinc-200 flex items-center justify-between px-6 sticky top-0 z-40">
          <div className="flex items-center gap-3 text-sm text-zinc-600">
            {/* Botão de Voltar */}
            {isDetailPage && (
              <button
                onClick={handleBack}
                className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-zinc-100 transition-colors text-zinc-600 hover:text-zinc-900"
                title="Voltar"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            
            {/* Breadcrumbs simples */}
            <span className="capitalize">
              {router.pathname === '/' ? 'Dashboard' : 
               router.pathname.split('/').filter(Boolean).join(' / ').replace(/\b\w/g, l => l.toUpperCase())}
            </span>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-6">
            {children}
          </div>
        </main>
      </div>

      {/* WhatsApp Status Alert */}
      <WhatsAppStatusAlert />

      {/* Notification Modal */}
      <NotificationModal
        isOpen={isNotificationModalOpen}
        onClose={() => setIsNotificationModalOpen(false)}
      />
    </div>
  );
};
