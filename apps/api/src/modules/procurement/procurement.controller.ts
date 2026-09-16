import { Body, Controller, Get, Headers, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Actor, Public, Roles } from '../../common/decorators/access';
import { Principal } from '../auth/auth.types';
import { ProcurementService } from './procurement.service';
import { QualityCheckInput, QualityCheckInputDto, RejectInput, RejectInputDto, StatusUpdateDto, WeighingInput, WeighingInputDto } from './procurement.types';

@ApiTags('Procurement')
@Controller('procurement')
export class ProcurementController {
  constructor(@Inject(ProcurementService) private readonly procurementService: ProcurementService) {}

  @Public()
  @ApiOperation({ summary: 'Get procurement history for authenticated farmer' })
  @ApiQuery({ name: 'farmerId', required: false, description: 'Optional farmer UUID' })
  @ApiResponse({ status: 200, description: 'List of farmer procurement lots with stage metrics' })
  @Get('my')
  async getMy(
    @Query('farmerId') queryFarmerId?: string,
    @Actor() actor?: Principal,
  ) {
    const farmerId = actor?.farmerId || queryFarmerId;
    return this.procurementService.getMyProcurement(farmerId);
  }

  @Public()
  @ApiOperation({ summary: 'Get current procurement status by booking ID or token ID' })
  @ApiParam({ name: 'bookingId', description: 'Booking UUID or token ID' })
  @ApiResponse({ status: 200, description: 'Detailed procurement lot status and measurements' })
  @Get(':bookingId')
  async getStatus(@Param('bookingId') bookingId: string) {
    return this.procurementService.getProcurementStatus(bookingId);
  }

  @Public()
  @ApiOperation({ summary: 'Generate official APMC Farmer Procurement Receipt (शेतकरी पावती / J-Form)' })
  @ApiParam({ name: 'id', description: 'Token UUID or Token Number' })
  @ApiResponse({ status: 200, description: 'Official structured receipt payload with standard APMC fields' })
  @Get(':id/receipt')
  async getReceipt(@Param('id') id: string) {
    return this.procurementService.getProcurementReceipt(id);
  }

  @Roles('CENTER_OPERATOR', 'ADMIN')
  @ApiOperation({ summary: 'Record gate entry arrival (transitions booked -> arrived)' })
  @ApiParam({ name: 'id', description: 'Token or booking UUID' })
  @ApiResponse({ status: 200, description: 'Gate entry confirmed with timestamp' })
  @Post(':id/gate-entry')
  async gateEntry(
    @Param('id') id: string,
    @Actor() actor: Principal,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    const staffId = actor?.sub || 'STAFF001';
    return this.procurementService.gateEntry(id, staffId, correlationId);
  }

  @Roles('CENTER_OPERATOR', 'ADMIN')
  @ApiOperation({ summary: 'Record gross & tare weighbridge readings (transitions arrived -> verification)' })
  @ApiParam({ name: 'id', description: 'Token or booking UUID' })
  @ApiBody({ type: WeighingInputDto })
  @ApiResponse({ status: 200, description: 'Weighing persisted and net weight calculated' })
  @Post(':id/weighing')
  async weighing(
    @Param('id') id: string,
    @Body() body: WeighingInput,
    @Actor() actor: Principal,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    const staffId = actor?.sub || 'STAFF001';
    return this.procurementService.weighing(id, body, staffId, correlationId);
  }

  @Roles('CENTER_OPERATOR', 'ADMIN')
  @ApiOperation({ summary: 'Record quality inspection and moisture % (transitions verification -> quality_check or rejected)' })
  @ApiParam({ name: 'id', description: 'Token or booking UUID' })
  @ApiBody({ type: QualityCheckInputDto })
  @ApiResponse({ status: 200, description: 'Quality inspection results recorded' })
  @Post(':id/quality-check')
  async qualityCheck(
    @Param('id') id: string,
    @Body() body: QualityCheckInput,
    @Actor() actor: Principal,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    const staffId = actor?.sub || 'STAFF001';
    return this.procurementService.qualityCheck(id, body, staffId, correlationId);
  }

  @Roles('CENTER_OPERATOR', 'ADMIN')
  @ApiOperation({ summary: 'Accept inspected lot (transitions quality_check -> accepted)' })
  @ApiParam({ name: 'id', description: 'Token or booking UUID' })
  @ApiResponse({ status: 200, description: 'Lot accepted into center inventory' })
  @Post([':id/lot-accepted', ':id/accept'])
  async lotAccepted(
    @Param('id') id: string,
    @Actor() actor: Principal,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    const staffId = actor?.sub || 'STAFF001';
    return this.procurementService.lotAccepted(id, staffId, correlationId);
  }

  @Roles('CENTER_OPERATOR', 'ADMIN')
  @ApiOperation({ summary: 'Reject procurement lot from any active stage' })
  @ApiParam({ name: 'id', description: 'Token or booking UUID' })
  @ApiBody({ type: RejectInputDto })
  @ApiResponse({ status: 200, description: 'Lot marked rejected with reason recorded' })
  @Post(':id/reject')
  async reject(
    @Param('id') id: string,
    @Body() body: RejectInput,
    @Actor() actor: Principal,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    const staffId = actor?.sub || 'STAFF001';
    return this.procurementService.reject(id, body, staffId, correlationId);
  }

  @Roles('CENTER_OPERATOR', 'ADMIN')
  @ApiOperation({ summary: 'Flexible patch for lot status and inspection fields' })
  @ApiParam({ name: 'id', description: 'Token or booking UUID' })
  @ApiBody({ type: StatusUpdateDto })
  @ApiResponse({ status: 200, description: 'Status updated' })
  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() body: Record<string, any>,
    @Actor() actor: Principal,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    const staffId = actor?.sub || 'STAFF001';
    return this.procurementService.updateStatus(id, body, staffId, correlationId);
  }
}
