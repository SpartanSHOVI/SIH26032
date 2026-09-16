import {Global,Injectable,Module,OnModuleDestroy} from '@nestjs/common';
import Redis from 'ioredis';
import {env} from '../../config/env';
@Injectable() export class RedisService extends Redis implements OnModuleDestroy {
 constructor(){super(env.REDIS_URL,{maxRetriesPerRequest:1,enableOfflineQueue:true});this.on('error',()=>{});}
 async onModuleDestroy(){this.disconnect();}
}
@Global() @Module({providers:[RedisService],exports:[RedisService]}) export class RedisModule {}
