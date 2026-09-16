import { Module } from '@nestjs/common';
import { EventsModule } from '../../infrastructure/events/events.module';
import { QueueModule } from '../queue/queue.module';
import { CenterController } from './center.controller';

@Module({ imports: [EventsModule, QueueModule], controllers: [CenterController] })
export class CenterModule {}
