import AdminShell from "./admin-shell";
import "./admin-ui.css";
export const metadata={title:'Панель управления — ЛХЛ-76',robots:{index:false,follow:false},alternates:{canonical:null},openGraph:null};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
