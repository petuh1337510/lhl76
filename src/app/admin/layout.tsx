import AdminShell from "./admin-shell";
import { cookies } from "next/headers";
import "./admin-ui.css";
import "./admin-theme.css";
import "./admin-modal.css";
export const metadata={title:'Панель управления — ЛХЛ-76',robots:{index:false,follow:false},alternates:{canonical:null},openGraph:null};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const theme = (await cookies()).get("lhl76_admin_theme")?.value === "dark" ? "dark" : "light";
  return <AdminShell initialTheme={theme}>{children}</AdminShell>;
}
