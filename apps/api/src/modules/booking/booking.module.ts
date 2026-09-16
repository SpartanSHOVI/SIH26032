import { Module } from '@nestjs/common';
import { EventsModule } from '../../infrastructure/events/events.module';
import { BookingController } from './booking.controller';

@Module({ imports: [EventsModule], controllers: [BookingController] })
export class BookingModule {}
