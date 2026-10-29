"use client";
import { PublicImage } from "@/components/public-image";
import { useState } from "react";

export default function MediaUpload({ label, value, kind, onChange }: { label: string; value?: string; kind: "teams" | "players"; onChange: (url: string) => void }) {
  const [loading,setLoading]=useState(false),[error,setError]=useState("");
  async function upload(file?: File) {
    if(!file)return;
    setLoading(true);setError("");
    const body=new FormData();body.append("file",file);body.append("kind",kind);
    try {
      const response=await fetch("/api/admin/upload",{method:"POST",body});
      const result=await response.json();
      if(response.ok)onChange(result.url);else setError(result.error||"Не удалось загрузить файл");
    } catch {
      setError("Не удалось загрузить файл. Проверьте соединение и выберите файл повторно.");
    } finally { setLoading(false); }
  }
  return <label className="mediaUpload" aria-busy={loading}><span>{label}</span>{value&&<a href={value} target="_blank" rel="noopener noreferrer" title="Открыть изображение"><PublicImage sizes="(max-width: 700px) 90vw, 320px" src={value} alt=""/></a>}<input type="file" disabled={loading} accept="image/jpeg,image/png,image/webp,image/gif" onChange={e=>{void upload(e.target.files?.[0]);e.target.value="";}}/><small role={error ? "alert" : "status"}>{loading?"Загрузка…":error||"JPG, PNG, WEBP или GIF · до 12 МБ"}</small></label>;
}
