import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  output: process.env.NEXT_STANDALONE === '1' ? 'standalone' : undefined,
  distDir: process.env.NEXT_DIST_DIR || ".next",
  images: {
    localPatterns:[{pathname:'/images/**',search:''},{pathname:'/uploads/**',search:''},{pathname:'/legacy-media/**',search:''},{pathname:'/api/public/legacy-media'},{pathname:'/api/public/remote-image'},{pathname:'/icon.png',search:''}],
    remotePatterns: [],
    maximumResponseBody:25*1024*1024,
    maximumDiskCacheSize:128*1024*1024,
    formats: ["image/webp"],
    qualities:[75,80,85],
    deviceSizes: [360, 480, 640, 768, 1024, 1280, 1600, 1920],
    imageSizes: [32, 48, 64, 96, 128, 160, 256],
    minimumCacheTTL: 300,
  },
  async headers() {
    return [
      {source:'/:path*',headers:[
        {key:'X-Content-Type-Options',value:'nosniff'},
        {key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},
        {key:'X-Frame-Options',value:'SAMEORIGIN'},
        {key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=()'},
      ]},
      {source:'/uploads/documents/:path*',headers:[{key:'Content-Disposition',value:'attachment'},{key:'Content-Security-Policy',value:"sandbox; default-src 'none'"}]},
      ...['pdf','doc','docx','xls','xlsx'].flatMap(extension=>['/uploads/:kind/:file.','/legacy-media/:file.','/documents/legacy/:file.'].map(prefix=>({source:prefix+extension,headers:[{key:'Content-Disposition',value:'attachment'},{key:'Content-Security-Policy',value:"sandbox; default-src 'none'"}]}))),
      { source: "/uploads/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] },
      { source: "/images/optimized/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] },
      { source: "/api/admin/:path*", headers: [{ key: "Cache-Control", value: "private, no-store" }] },
      { source: "/admin/:path*", headers: [{ key: "Cache-Control", value: "private, no-store" }] },
    ];
  },
  async rewrites() {
    // Next production indexes public at startup. Newly uploaded/generated assets
    // need a safe fallback; existing static files still use the normal fast path.
    return { fallback: [
      { source: "/uploads/:path*", destination: "/api/public/assets/uploads/:path*" },
      { source: "/images/optimized/:path*", destination: "/api/public/assets/images/optimized/:path*" },
    ] };
  },
};
export default nextConfig;
