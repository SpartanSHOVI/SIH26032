import { Body, Controller, Get, Headers, Inject, Param, Post, Query } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Actor, Roles } from '../../common/decorators/access';
import { Principal } from '../auth/auth.types';
import { AdminService, RebalanceRequestDto, RebalanceRequestInput } from './admin.service';

@ApiTags('Admin')
@Roles('ADMIN')
@Controller('admin')
export class AdminController {
  constructor(@Inject(AdminService) private readonly adminService: AdminService) {}

  @ApiOperation({ summary: 'Get administrative dashboard macro overview and KPIs' })
  @ApiQuery({ name: 'date', required: false, example: '2026-09-12' })
  @ApiResponse({ status: 200, description: 'Aggregated KPI metrics' })
  @Get('overview')
  async overview(@Query('date') date?: string) {
    return this.adminService.getOverview(date);
  }

  @ApiOperation({ summary: 'List and filter procurement centers' })
  @ApiResponse({ status: 200, description: 'List of procurement centers with operational telemetry' })
  @Get('centers')
  async centers(@Query() q: Record<string, string>) {
    return this.adminService.getCenters(q);
  }

  @ApiOperation({ summary: 'List farmer registrations and scheduled arrivals' })
  @ApiQuery({ name: 'limit', required: false, example: '50' })
  @ApiResponse({ status: 200, description: 'List of registered farmers' })
  @Get('farmers')
  async farmers(@Query('limit') limit?: string) {
    return this.adminService.getFarmers(limit ? Number(limit) : 200);
  }

  @ApiOperation({ summary: 'Predict demand and farmer arrival trend using linear regression' })
  @ApiParam({ name: 'centerId', description: 'Procurement center UUID' })
  @ApiResponse({ status: 200, description: 'Forecasted arrival demand and historical points' })
  @Get('centers/:centerId/predict-demand')
  async predictDemand(@Param('centerId') centerId: string) {
    return this.adminService.predictDemand(centerId);
  }

  @ApiOperation({ summary: 'Generate balanced hourly slot capacity for a center' })
  @ApiParam({ name: 'centerId', description: 'Procurement center UUID' })
  @ApiResponse({ status: 200, description: 'Generated slot schedules' })
  @Post('centers/:centerId/generate-slots')
  async generateSlots(
    @Param('centerId') centerId: string,
    @Body() body: Record<string, any>,
  ) {
    return this.adminService.generateSlots(centerId, body);
  }

  @ApiOperation({ summary: 'Query real aggregate metrics (capacity vs bookings, wait times, completion rate)' })
  @ApiQuery({ name: 'date', required: false, example: '2026-09-12' })
  @ApiQuery({ name: 'state', required: false, example: 'Punjab' })
  @ApiResponse({ status: 200, description: 'Center analytics aggregation' })
  @Get('analytics')
  async analytics(
    @Query('date') date?: string,
    @Query('state') state?: string,
  ) {
    return this.adminService.getAnalytics(date, state);
  }

  @ApiOperation({ summary: 'Rebalance farmer token load from congested to underutilized center' })
  @ApiBody({ type: RebalanceRequestDto })
  @ApiResponse({ status: 200, description: 'Validated rebalance reservation recorded' })
  @Post('rebalance-mandi')
  async rebalance(
    @Body() body: RebalanceRequestInput,
    @Actor() actor?: Principal,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    const actorId = actor?.sub ?? 'ADMIN_SYSTEM';
    return this.adminService.rebalanceMandi(body, actorId, correlationId);
  }

  @ApiOperation({ summary: 'Query immutable audit log history of inter-mandi rebalance actions' })
  @ApiQuery({ name: 'limit', required: false, example: '50' })
  @ApiResponse({ status: 200, description: 'Audit trail records' })
  @Get('rebalance-mandi/history')
  async rebalanceHistory(@Query('limit') limit?: string) {
    return this.adminService.getRebalanceHistory(limit ? Number(limit) : 50);
  }

  @ApiOperation({ summary: 'Inspect BullMQ outbox-dispatch queue depth and status breakdown' })
  @ApiResponse({ status: 200, description: 'Queue metrics (waiting, active, completed, failed, delayed)' })
  @Get('queues')
  async queues() {
    return this.adminService.getQueues();
  }

  @ApiOperation({ summary: 'Query dead-lettered outbox jobs that exhausted retries' })
  @ApiQuery({ name: 'limit', required: false, example: '50' })
  @ApiResponse({ status: 200, description: 'List of dead-letter jobs with failure diagnostics' })
  @Get('queues/dead-letter')
  async deadLetter(@Query('limit') limit?: string) {
    return this.adminService.getDeadLetterJobs(limit ? Number(limit) : 50);
  }
}
