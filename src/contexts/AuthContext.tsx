import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type User = {
  id: string;
  email: string;
  name: string;
  role: string;
  tenantId: string;
};

type AuthContextType = {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  loading: boolean;
  clearAuth: () => void; // Limpar autenticação sem redirecionar
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Verificar se há token salvo no localStorage
    const savedToken = localStorage.getItem('auth_token');
    const savedUser = localStorage.getItem('auth_user');

    if (savedToken && savedUser) {
      setToken(savedToken);
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        console.error('Error parsing saved user:', e);
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
      }
    } else {
      // Se não houver token, limpar qualquer dado inválido
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
    }
    setLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    try {
      // O backend agora busca o tenantId automaticamente pelo email do usuário
      const response = await fetch(`${API_BASE}/api/v1/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Login failed');
      }

      const { user: userData, token: tokenData } = data.data;

      setUser(userData);
      setToken(tokenData);

      // Salvar no localStorage
      localStorage.setItem('auth_token', tokenData);
      localStorage.setItem('auth_user', JSON.stringify(userData));
    } catch (error: any) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
  };

  const clearAuth = () => {
    // Limpar autenticação sem redirecionar (útil para 401)
    setUser(null);
    setToken(null);
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        logout,
        clearAuth,
        isAuthenticated: !!user && !!token,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

