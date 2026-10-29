/** Two independent, admin-managed homepage carousel zones. */
export type BannerZone = "HERO" | "PROMO_TILE";
export type BannerSlide = { id:string; zone:BannerZone; title?:string; imageDesktop:string; imageMobile?:string; href?:string; startsAt?:Date; endsAt?:Date; sortOrder:number; isActive:boolean; focalPoint?:{x:number;y:number} };
