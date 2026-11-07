import type { SVGProps } from "react";

export type IconName = "vk" | "menu" | "search" | "play" | "arrow-right" | "arrow-left" | "chevron-right" | "external" | "print" | "download" | "pin" | "sort" | "arrow-down" | "calendar" | "shirt" | "ruler" | "hash" | "star" | "edit" | "plus" | "save";
const paths: Record<IconName, React.ReactNode> = {
  vk: <path fill="currentColor" stroke="none" d="M12.785 16.241c-5.47 0-8.59-3.75-8.72-9.99h2.74c.09 4.58 2.11 6.52 3.71 6.92v-6.92h2.58v3.95c1.58-.17 3.24-1.97 3.8-3.95h2.58c-.43 2.44-2.23 4.24-3.51 4.98 1.28.6 3.33 2.17 4.11 5.01h-2.84c-.61-1.9-2.13-3.37-4.14-3.57v3.57h-.31Z" />,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" /></>,
  play: <path d="m8 5 11 7-11 7Z" />,
  "arrow-right": <path d="M4 12h16m-6-6 6 6-6 6" />,
  "arrow-left": <path d="M20 12H4m6-6-6 6 6 6" />,
  "chevron-right": <path d="m9 5 7 7-7 7" />,
  external: <><path d="M14 4h6v6m0-6L10 14M10 4H4v16h16v-6" /></>,
  print: <><path d="M7 8V3h10v5M7 17H4V8h16v9h-3M7 14h10v7H7Z" /><path d="M17 11h.01" /></>,
  download: <path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" />,
  pin: <><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" /><circle cx="12" cy="10" r="2" /></>,
  sort: <path d="M8 20V4m-4 4 4-4 4 4m4-4v16m-4-4 4 4 4-4" />,
  "arrow-down": <path d="M12 4v16m-6-6 6 6 6-6" />,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4m10-4v4M3 10h18" /></>,
  shirt: <path d="m8 4-5 3 2 5 3-1v9h8v-9l3 1 2-5-5-3a4 4 0 0 1-8 0Z" />,
  ruler: <path d="m3 16 13-13 5 5L8 21Zm4-4 2 2m1-5 2 2m1-5 2 2" />,
  hash: <path d="M10 4 7 20m10-16-3 16M4 9h16M3 15h16" />,
  star: <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z" />,
  edit: <path d="m14 6 4 4M4 20l4.5-1 11-11a2.8 2.8 0 0 0-4-4l-11 11Z" />,
  plus: <path d="M12 5v14M5 12h14" />,
  save: <path d="M5 3h12l4 4v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm2 0v6h9V3M7 21v-8h10v8" />,
};
export function UiIcon({ name, ...props }: SVGProps<SVGSVGElement> & { name: IconName }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...props}>{paths[name]}</svg>;
}
