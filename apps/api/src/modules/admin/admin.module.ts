import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { DatabaseModule } from '../../infrastructure/database/database.service';
import { EventsModule } from '../../infrastructure/events/events.module';
import { AuditModule } from '../../infrastructure/audit/audit.module';

import { JobsModule } from '../../infrastructure/jobs/jobs.module';

@Module({
  imports: [DatabaseModule, EventsModule, AuditModule, JobsModule],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
