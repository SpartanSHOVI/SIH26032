import { SetMetadata,createParamDecorator,ExecutionContext } from '@nestjs/common';
import {Role} from '../../modules/auth/auth.types';
export const Public=()=>SetMetadata('public',true);
export const Roles=(...roles:Role[])=>SetMetadata('roles',roles);
export const Actor=createParamDecorator((_:unknown,ctx:ExecutionContext)=>ctx.switchToHttp().getRequest().user);
