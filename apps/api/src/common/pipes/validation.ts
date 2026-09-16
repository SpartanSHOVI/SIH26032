import { BadRequestException } from '@nestjs/common';
import {z} from 'zod';
export function parse<T>(schema:z.ZodType<T>,value:unknown):T {const result=schema.safeParse(value);if(!result.success)throw new BadRequestException(result.error.issues.map(x=>`${x.path.join('.')}: ${x.message}`).join('; '));return result.data;}
export const uuid=z.string().uuid();
export const id=z.union([z.string().regex(/^\d+$/),z.number().int().positive().max(Number.MAX_SAFE_INTEGER)]).transform(String);
export const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s=>!Number.isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s,'Invalid calendar date');
export function today(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
export function businessDate(value?:string){return parse(date,value||today());}
