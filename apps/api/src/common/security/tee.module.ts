import { Module } from '@nestjs/common';
import { TeeSecurityService } from './tee.service';
import { TeeController } from './tee.controller';

@Module({
  controllers: [TeeController],
  providers: [TeeSecurityService],
  exports: [TeeSecurityService],
})
export class TeeSecurityModule {}
