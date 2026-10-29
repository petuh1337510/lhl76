import { z } from 'zod';
const name = z.string().trim().min(2).max(120);
const order = z.number().int().min(0).max(9999);
export const createCompetitionInput = z.object({seasonId:z.string().uuid(),name,type:z.enum(['CHAMPIONSHIP','TOURNAMENT']),sortOrder:order}).strict();
export const editCompetitionInput = z.object({id:z.string().uuid(),name,sortOrder:order,updatedAt:z.string().datetime()}).strict();
