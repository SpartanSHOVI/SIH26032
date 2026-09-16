import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { DatabaseModule } from '../database/database.service';

@Global()
@Module({
  imports: [DatabaseModule],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
