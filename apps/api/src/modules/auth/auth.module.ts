import {Global,Module} from '@nestjs/common';
import {AuthService} from './auth.service';import {AuthRepository} from './auth.repository';import {AuthController} from './auth.controller';
@Global() @Module({providers:[AuthService,AuthRepository],controllers:[AuthController],exports:[AuthService]}) export class AuthModule {}
