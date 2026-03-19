import { AdminLayoutWrapper } from '@/components/Admin/AdminLayoutWrapper';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminLayoutWrapper>{children}</AdminLayoutWrapper>;
}
