import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const root=path.resolve('work/final-reconciliation-2026-10-29T05-52-30-265Z');
const staged=JSON.parse(fs.readFileSync(path.join(root,'staged-media-results.json'),'utf8'));
const old=JSON.parse(fs.readFileSync('src/lib/legacy-media-manifest.json','utf8'));
const second=path.resolve('D:/LHL76-Backups/approved-2026-10-29T06-27-17-636Z/final-media');
fs.mkdirSync(second,{recursive:true});
const manifest={};
for(const item of staged.results){if(!item.ok)throw new Error('Unverified image');if(!/^[a-f0-9]{64}\.(jpg|png|gif|webp|avif)$/.test(item.file))throw new Error('Invalid filename');const bytes=fs.readFileSync(path.join(root,'staged-media',item.file));if(createHash('sha256').update(bytes).digest('hex')!==item.sha256)throw new Error('Image checksum mismatch');
 for(const destination of [path.resolve('public/legacy-media',item.file),path.join(second,item.file)]){if(fs.existsSync(destination)){if(createHash('sha256').update(fs.readFileSync(destination)).digest('hex')!==item.sha256)throw new Error('Existing image differs');}else fs.copyFileSync(path.join(root,'staged-media',item.file),destination,fs.constants.COPYFILE_EXCL);}
 if(!old[item.url])manifest[item.url]='/legacy-media/'+item.file;
}
// Generated additive URL index; never rewrites the existing editor/media index.
const output='src/lib/legacy-final-media-manifest.json';
fs.writeFileSync(output,JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
fs.copyFileSync(output,path.join(second,'manifest.json'),fs.constants.COPYFILE_EXCL);
console.log(JSON.stringify({verified:staged.results.length,addedMappings:Object.keys(manifest).length,independentCopy:second}));
