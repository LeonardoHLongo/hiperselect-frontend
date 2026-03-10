import { MainLayout } from './MainLayout';

type DashboardLayoutProps = {
  children: React.ReactNode;
};

// DashboardLayout agora é apenas um wrapper do MainLayout
// Mantido para compatibilidade com código existente
export const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  return <MainLayout>{children}</MainLayout>;
};

