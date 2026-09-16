import { Body, Controller, Get, Headers, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Actor, Public, Roles } from '../../common/decorators/access';
import { Principal } from '../auth/auth.types';
import { PaymentsService } from './payments.service';
import { PaymentStatus, UpdatePaymentStatusDto } from './payment.types';

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  constructor(@Inject(PaymentsService) private readonly paymentsService: PaymentsService) {}

  @Public()
  @ApiOperation({ summary: 'Get payment disbursement history for authenticated farmer' })
  @ApiQuery({ name: 'farmerId', required: false, description: 'Optional farmer UUID' })
  @ApiResponse({ status: 200, description: 'List of PFMS/DBT payment records with MSP calculations' })
  @Get('my')
  async getMy(
    @Query('farmerId') queryFarmerId?: string,
    @Actor() actor?: Principal,
  ) {
    const farmerId = actor?.farmerId || queryFarmerId;
    return this.paymentsService.getMyPayments(farmerId);
  }

  @Public()
  @ApiOperation({ summary: 'Get payment details by procurement lot ID or token ID' })
  @ApiParam({ name: 'procurementLotId', description: 'Procurement lot UUID, token number, or UTR reference' })
  @ApiResponse({ status: 200, description: 'PFMS payment status details' })
  @Get(':procurementLotId')
  async getStatus(@Param('procurementLotId') procurementLotId: string) {
    return this.paymentsService.getPaymentStatus(procurementLotId);
  }

  @Roles('CENTER_OPERATOR', 'ADMIN')
  @ApiOperation({ summary: 'Advance PFMS payment state machine (PENDING -> PROCESSING -> CREDITED)' })
  @ApiParam({ name: 'procurementLotId', description: 'Procurement lot UUID' })
  @ApiResponse({ status: 200, description: 'Payment transitioned to next lifecycle stage' })
  @Post(':procurementLotId/transition')
  async advancePayment(
    @Param('procurementLotId') procurementLotId: string,
    @Actor() actor?: Principal,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    const staffId = actor?.sub || 'SYSTEM';
    return this.paymentsService.advancePayment(procurementLotId, staffId, correlationId);
  }

  @Roles('CENTER_OPERATOR', 'ADMIN')
  @ApiOperation({ summary: 'Explicitly update payment status, amount, and UTR reference' })
  @ApiParam({ name: 'procurementLotId', description: 'Procurement lot UUID' })
  @ApiBody({ type: UpdatePaymentStatusDto })
  @ApiResponse({ status: 200, description: 'Payment status updated' })
  @Patch(':procurementLotId/status')
  async updateStatus(
    @Param('procurementLotId') procurementLotId: string,
    @Body() body: UpdatePaymentStatusDto,
    @Actor() actor?: Principal,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    const staffId = actor?.sub || 'SYSTEM';
    return this.paymentsService.updatePaymentStatus(
      procurementLotId,
      body.status,
      {
        amount: body.amount,
        utr_reference: body.utr_reference,
        pfms_response: body.pfms_response,
      },
      staffId,
      correlationId,
    );
  }
}
