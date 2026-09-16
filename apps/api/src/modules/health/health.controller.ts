import { Controller, Get, Inject } from '@nestjs/common';
import { Public } from '../../common/decorators/access';
import { DatabaseService, rows } from '../../infrastructure/database/database.service';
import { RedisService } from '../../infrastructure/redis/redis.service';

@Controller('health')
export class HealthController {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(RedisService) private readonly redis: RedisService,
  ) {}

  @Public()
  @Get()
  async health() {
    await rows(this.db, 'select 1');
    await this.redis.ping();
    return { status: 'ok', service: 'annsetu-api' };
  }
}
