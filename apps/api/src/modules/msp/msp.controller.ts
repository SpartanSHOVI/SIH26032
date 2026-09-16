import { Body, Controller, Get, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Actor, Public, Roles } from '../../common/decorators/access';
import { Principal } from '../auth/auth.types';
import { MspService } from './msp.service';
import { CreateMspRateDto, UpdateMspRateDto } from './msp.types';

@ApiTags('Minimum Support Price (MSP)')
@Controller('msp')
export class MspController {
  constructor(@Inject(MspService) private readonly mspService: MspService) {}

  @Public()
  @ApiOperation({ summary: 'Get statutory MSP rates list with optional filters and category breakdown' })
  @ApiQuery({ name: 'category', required: false, example: 'Cereal' })
  @ApiQuery({ name: 'season', required: false, example: 'Rabi 2025-26' })
  @ApiQuery({ name: 'active_only', required: false, type: Boolean })
  @ApiQuery({ name: 'search', required: false, example: 'wheat' })
  @ApiResponse({ status: 200, description: 'List of statutory MSP rates' })
  @Get()
  async getAllRates(
    @Query('category') category?: string,
    @Query('season') season?: string,
    @Query('active_only') activeOnly?: string,
    @Query('search') search?: string,
  ) {
    return this.mspService.getAllRates({
      category,
      season,
      active_only: activeOnly === 'true' || activeOnly === '1',
      search,
    });
  }

  @Public()
  @ApiOperation({ summary: 'Get active statutory MSP floor price and bonus for a specific crop' })
  @ApiParam({ name: 'crop', example: 'Wheat', description: 'Crop commodity name' })
  @ApiResponse({ status: 200, description: 'Current MSP floor price, state bonus, and effective rate' })
  @Get('crop/:crop')
  async getRateForCrop(@Param('crop') crop: string) {
    return this.mspService.getRateForCrop(crop);
  }

  @ApiBearerAuth()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get historical audit trail of MSP rate modifications (Nodal Officer only)' })
  @ApiQuery({ name: 'crop', required: false, example: 'Wheat' })
  @ApiQuery({ name: 'limit', required: false, example: 50 })
  @ApiResponse({ status: 200, description: 'List of audit records detailing price and bonus adjustments' })
  @Get('audit-logs')
  async getAuditLogs(
    @Query('crop') crop?: string,
    @Query('limit') limit?: string,
  ) {
    return this.mspService.getAuditLogs(crop, limit ? Number(limit) : 50);
  }

  @ApiBearerAuth()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Inscribe a new notified crop floor price (Nodal Officer only)' })
  @ApiBody({ type: CreateMspRateDto })
  @ApiResponse({ status: 201, description: 'Successfully inscribed new crop rate' })
  @Post()
  async createRate(
    @Body() dto: CreateMspRateDto,
    @Actor() actor?: Principal,
  ) {
    return this.mspService.createRate(dto, actor);
  }

  @ApiBearerAuth()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Update crop MSP rate, state bonus incentive, or season with mandatory audit reason' })
  @ApiParam({ name: 'id', description: 'MSP rate UUID' })
  @ApiBody({ type: UpdateMspRateDto })
  @ApiResponse({ status: 200, description: 'Successfully updated MSP rate and recorded audit entry' })
  @Patch(':id')
  async updateRate(
    @Param('id') id: string,
    @Body() dto: UpdateMspRateDto,
    @Actor() actor?: Principal,
  ) {
    return this.mspService.updateRate(id, dto, actor);
  }

  @ApiBearerAuth()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Synchronize rates against statutory CCEA / CACP Gazette benchmarks (Nodal Officer only)' })
  @ApiResponse({ status: 200, description: 'Benchmark sync result and list of updated commodities' })
  @Post('sync-official')
  async syncOfficialBenchmarks(@Actor() actor?: Principal) {
    return this.mspService.syncOfficialBenchmarks(actor);
  }
}
