import {z} from 'zod';
const text=(max:number)=>z.string().max(max).optional();
const measurement=(max:number)=>z.union([z.literal(''),z.null(),z.number().int().min(0).max(max),z.string().regex(/^\d+$/).refine(s=>Number(s)<=max)]).optional();
const profile=z.object({id:text(128),firstName:text(100),lastName:text(100),patronymic:text(100),nativeName:text(200),country:text(100),birthPlace:text(200),league:text(200),position:text(100),stickHand:text(50),baseNumber:text(3),heightCm:measurement(300),weightKg:measurement(400),birthDate:z.union([z.literal(''),z.null(),z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s=>{const d=new Date(s);return Number.isFinite(d.getTime())&&d.toISOString().startsWith(s)})]).optional()}).passthrough();
const team=z.object({id:text(128),name:text(200),shortName:text(100),city:text(200).nullable(),shortDescription:text(2000).nullable(),description:text(50000).nullable(),achievements:text(20000).nullable()}).passthrough();
const roster=z.object({id:text(128),playerId:text(128),teamEntryId:text(128),number:text(3),leadership:z.enum(['NONE','CAPTAIN','ASSISTANT']).optional(),status:z.enum(['ACTIVE','INACTIVE','SUSPENDED']).optional(),categoryId:text(128)}).passthrough();
const suspension=z.object({id:text(128),rosterEntryId:text(128),reason:text(2000),note:text(10000),matchesCount:z.union([z.number().int().min(1).max(10000),z.string().regex(/^\d+$/).refine(s=>Number(s)>=1&&Number(s)<=10000)]).optional(),status:z.enum(['ACTIVE','COMPLETED','CANCELLED']).optional()}).passthrough();
export function validAdminInput(path:string,body:unknown){
 const schema=path==='/api/admin/player'||path==='/api/admin/players'?profile:path==='/api/admin/team'||path==='/api/admin/teams'?team:path==='/api/admin/roster'?roster:path==='/api/admin/suspensions'?suspension:null;
 return !schema||schema.safeParse(body).success;
}
