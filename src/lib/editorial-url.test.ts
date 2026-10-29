import {expect,it} from 'vitest';
import {safeEditorialUrl,invalidEditorialField} from './editorial-url';
it('rejects active schemes, control characters, private hosts and URL tricks',()=>{
 for(const value of ['javascript:alert(1)','data:text/html,test','file:///x','//evil.com','/\\evil.com','/%2f%2fevil.com','/%255cevil.com','https://127.1/a','https://0x7f000001/a','https://[::1]/','https://localhost/a','https://x.internal/a','https://user:pass@example.com/','java\nscript:x','/foo/%2e%2e/private'])expect(safeEditorialUrl(value),value).toBeNull();
});
it('allows normal local and public HTTPS URLs and confines local documents',()=>{
 expect(safeEditorialUrl('/news/article?tab=all')).toBeTruthy();expect(safeEditorialUrl('https://vk.com/lhl76')).toBeTruthy();
 expect(safeEditorialUrl('/uploads/documents/example.pdf',true)).toBeTruthy();expect(safeEditorialUrl('/admin',true)).toBeNull();
 expect(invalidEditorialField({link:'javascript:x'})).toBe('link');
});
