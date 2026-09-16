import { Module } from '@nestjs/common';
import { ProcurementController } from './procurement.controller';
import { ProcurementService } from './procurement.service';
import { DatabaseModule } from '../../infrastructure/database/database.service';
import { EventsModule } from '../../infrastructure/events/events.module';
import { AuditModule } from '../../infrastructure/audit/audit.module';
import { TeeSecurityModule } from '../../common/security/tee.module';

@Module({
  imports: [DatabaseModule, EventsModule, AuditModule, TeeSecurityModule],
  controllers: [ProcurementController],
  providers: [ProcurementService],
  exports: [ProcurementService],
})
export class ProcurementModule {}
