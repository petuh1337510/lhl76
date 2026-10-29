import type {MetadataRoute} from 'next';
import {publicOrigin} from '@/lib/seo';
export default function robots():MetadataRoute.Robots{
 const origin=publicOrigin();return {rules:{userAgent:'*',allow:'/',disallow:['/admin','/api/']},...(origin?{sitemap:origin+'/sitemap.xml'}:{})};
}
