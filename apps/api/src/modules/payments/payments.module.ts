import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PfmsAdapterService } from './pfms-adapter.service';
import { DatabaseModule } from '../../infrastructure/database/database.service';
import { EventsModule } from '../../infrastructure/events/events.module';
import { AuditModule } from '../../infrastructure/audit/audit.module';

@Module({
  imports: [DatabaseModule, EventsModule, AuditModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, PfmsAdapterService],
  exports: [PaymentsService, PfmsAdapterService],
})
export class PaymentsModule {}
