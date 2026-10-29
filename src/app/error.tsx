"use client";

import Link from "next/link";

export default function PageError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="shell" style={{ paddingBlock: 48 }}>
    <h1>Не удалось загрузить страницу</h1>
    <p role="alert">Временная ошибка загрузки. Попробуйте ещё раз.</p>
    <div className="publicRefreshNotice"><button onClick={reset}>Повторить</button><Link href="/">На главную</Link></div>
  </main>;
}
