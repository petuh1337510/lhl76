"use client";

import { useRef, useState } from "react";
import { PublicImage } from "@/components/public-image";
import styles from "./player-photo-viewer.module.css";

export function PlayerPhotoViewer({ photoUrl, name }: { photoUrl: string | null; name: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const image = photoUrl || "/images/player-placeholder.svg";

  const showPhoto = () => {
    if (!dialogRef.current?.open) {
      setOpen(true);
      dialogRef.current?.showModal();
    }
  };

  return <>
    <i className="playerPortrait">
      {photoUrl ? <button className={styles.trigger} type="button" onClick={showPhoto} aria-label={`Увеличить фотографию: ${name}`}>
        <PublicImage priority width={240} height={320} sizes="(max-width: 600px) 80px, 100px" src={image} alt={name} />
      </button> : <PublicImage priority width={240} height={320} sizes="(max-width: 600px) 80px, 100px" src={image} alt={name} />}
    </i>
    {photoUrl ? <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-label={`Фотография игрока ${name}`}
      onClose={() => setOpen(false)}
      onClick={(event) => { if (event.target === dialogRef.current) dialogRef.current?.close(); }}
    >
      <button className={styles.close} type="button" onClick={() => dialogRef.current?.close()} aria-label="Закрыть фотографию">×</button>
      {open ? <PublicImage quality={85} className={styles.fullPhoto} width={1200} height={1600} sizes="100vw" src={photoUrl} alt={name} /> : null}
    </dialog> : null}
  </>;
}
