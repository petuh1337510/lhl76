"use client";

export default function AdminError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <section className="adminContent"><div className="adminForm" role="alert">
    <h1>Не удалось открыть раздел</h1>
    <p>Попробуйте загрузить его повторно. Это действие не сохраняет и не изменяет данные.</p>
    <footer><button type="button" onClick={reset}>Повторить загрузку</button><a href="/admin">К панели управления</a></footer>
  </div></section>;
}
