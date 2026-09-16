import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.service';
import { RedisModule } from '../../infrastructure/redis/redis.service';
import { MspController } from './msp.controller';
import { MspService } from './msp.service';

@Module({
  imports: [DatabaseModule, RedisModule],
  controllers: [MspController],
  providers: [MspService],
  exports: [MspService],
})
export class MspModule {}
