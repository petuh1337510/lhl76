import { WebVitals } from "@/components/web-vitals";
import type { Metadata } from "next";
import {headers} from 'next/headers';
import { Inter, Roboto_Condensed } from "next/font/google";
import "./globals.css";
import "./polish.css";
import "./performance.css";
import "./public-ui.css";
import { PublicSiteFooter, PublicSiteProvider } from "@/components/public-site-header";
import { getPublicSiteContext } from "@/lib/public-site-context";
import {pageMetadata} from '@/lib/seo';

const inter = Inter({ subsets: ["latin", "cyrillic"], display: "swap", variable: "--font-inter" });
const condensed = Roboto_Condensed({ subsets: ["latin", "cyrillic"], display: "swap", variable: "--font-condensed", preload: false });

export const metadata: Metadata = pageMetadata('Любительская хоккейная лига Ярославля','Официальный сайт ЛХЛ-76: соревнования, календарь и результаты матчей, команды, игроки и новости хоккея.','/');
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Nonce CSP requires request-time HTML; data caches remain independently scoped.
  await headers();
  const context = await getPublicSiteContext();
  return <html lang="ru" className={`${inter.variable} ${condensed.variable}`}><body>{process.env.TELEMETRY_ENABLED !== "0" && <WebVitals />}<PublicSiteProvider context={context}>{children}<div className="globalPublicFooter"><PublicSiteFooter global /></div></PublicSiteProvider></body></html>;
}
