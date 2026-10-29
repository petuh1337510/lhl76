import {describe,it,expect} from 'vitest';
import {validFileSignature} from './file-validation';
import {localMediaUrl} from './local-media';
describe('public media and upload boundaries',()=>{
 it('rejects HTML disguised as a document',()=>{expect(validFileSignature(Buffer.from('<script>alert(1)</script>'),'.pdf')).toBe(false);expect(validFileSignature(Buffer.from('<html>invalid document</html>'),'.docx')).toBe(false);});
 it('recognizes a PDF signature and trailer',()=>expect(validFileSignature(Buffer.from('%PDF-1.7\nbody\n%%EOF'),'.pdf')).toBe(true));
 it('maps only the legacy host and content directory',()=>{expect(localMediaUrl('https://lhl-76.ru/wp-content/uploads/a.jpg')).toContain('/api/public/legacy-media?source=');expect(localMediaUrl('https://evil.test/wp-content/a.jpg')).toBe('');expect(localMediaUrl('/images/logo.png')).toBe('/images/logo.png');});
});
