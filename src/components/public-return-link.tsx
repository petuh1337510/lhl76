"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { safeReturn } from "@/lib/public-navigation";
export function PublicReturnLink({ fallback, children, className }: { fallback: string; children: React.ReactNode; className?: string }) {
  const params = useSearchParams();
  const from = safeReturn(params.get("from"));
  return <Link href={from || fallback} className={className}>{from ? "← Назад к списку" : children}</Link>;
}
