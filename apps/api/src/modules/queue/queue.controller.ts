import { Controller, Get, Inject, Param, Query } from '@nestjs/common';
import { Public } from '../../common/decorators/access';
import { QueueService } from './queue.service';

@Controller()
export class QueueController {
  constructor(@Inject(QueueService) private readonly queue: QueueService) {}

  @Public()
  @Get(['tokens/lookup', 'queue/lookup'])
  lookup(@Query('value') value?: string) {
    return this.queue.lookup(value);
  }

  @Public()
  @Get('public/track')
  publicTrack(@Query('value') value?: string) {
    return this.queue.publicLookup(value);
  }

  @Public()
  @Get(['tokens/:tokenId', 'queue/:tokenId'])
  token(@Param('tokenId') tokenId: string) {
    return this.queue.tokenDetail(tokenId);
  }

  @Get(['farmers/:farmerId/notifications', 'notifications'])
  notifications(@Param('farmerId') farmerId?: string) {
    return this.queue.notifications(farmerId);
  }
}
