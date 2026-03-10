import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'next/router';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export const useTicketsCount = () => {
  const { token, clearAuth } = useAuth();
  const router = useRouter();
  const [count, setCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const fetchCount = useCallback(async () => {
    if (!token) {
      setCount(0);
      setLoading(false);
      return;
    }

    try {
      const headers: HeadersInit = {
        'Authorization': `Bearer ${token}`,
      };
      const res = await fetch(`${API_BASE}/api/v1/tickets/count`, { headers });
      
      if (!res.ok) {
        if (res.status === 401) {
          // Token inválido ou expirado - limpar autenticação
          console.warn('[useTicketsCount] Token inválido ou expirado - limpando autenticação');
          clearAuth();
        }
        console.error('[useTicketsCount] Failed to fetch tickets count:', res.status);
        setCount(0);
        return;
      }
      
      const data = await res.json();
      if (data.success && data.data?.count !== undefined) {
        setCount(data.data.count);
      } else {
        setCount(0);
      }
    } catch (error) {
      console.error('[useTicketsCount] Error fetching tickets count:', error);
      setCount(0);
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Marcar como visualizado quando estiver na página de tickets
  const markAsViewed = useCallback(async () => {
    if (!token) return;
    
    const currentPath = router.asPath?.split('?')[0] || router.pathname;
    const isOnTicketsPage = currentPath === '/tickets' || currentPath.startsWith('/tickets/');
    
    if (!isOnTicketsPage) return;

    try {
      const headers: HeadersInit = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      };
      
      const res = await fetch(`${API_BASE}/api/v1/tickets/viewed`, {
        method: 'POST',
        headers,
      });
      
      if (res.ok) {
        console.log('[useTicketsCount] ✅ Tickets marked as viewed');
        // Atualizar contador imediatamente após marcar como visualizado
        // Aguardar um pouco para garantir que o backend processou
        await new Promise(resolve => setTimeout(resolve, 300));
        await fetchCount();
      }
    } catch (error) {
      console.error('[useTicketsCount] Error marking tickets as viewed:', error);
    }
  }, [token, router.asPath, router.pathname, fetchCount]);

  useEffect(() => {
    fetchCount();
    
    // Atualizar a cada 5 segundos (mesmo intervalo das notificações)
    const interval = setInterval(fetchCount, 5000);
    
    return () => clearInterval(interval);
  }, [fetchCount]);

  // Marcar como visualizado quando a rota mudar para /tickets
  useEffect(() => {
    const currentPath = router.asPath?.split('?')[0] || router.pathname;
    const isOnTicketsPage = currentPath === '/tickets' || currentPath.startsWith('/tickets/');
    
    if (isOnTicketsPage) {
      markAsViewed();
    }
  }, [router.asPath, router.pathname, markAsViewed]);

  return { count, loading, refresh: fetchCount };
};
