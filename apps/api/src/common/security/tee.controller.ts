import { Controller, Get, Post, Body, Inject } from '@nestjs/common';
import { SetMetadata } from '@nestjs/common';
import { TeeSecurityService, TeeAttestationReport } from './tee.service';

const Public = () => SetMetadata('public', true);

@Controller('security')
export class TeeController {
  constructor(
    @Inject(TeeSecurityService) private readonly teeService: TeeSecurityService,
  ) {}

  @Get('tee-status')
  @Public()
  getStatus(): TeeAttestationReport {
    return this.teeService.getAttestationReport();
  }

  @Post('verify-seal')
  @Public()
  verifySeal(
    @Body() body: { record_id: string | number; data: Record<string, any>; seal: string },
  ) {
    const isValid = this.teeService.verifySeal(body.record_id, body.data, body.seal);
    return {
      verified: isValid,
      seal: body.seal,
      enclave_id: 'TEE-SGX-ANSE-2026-IN',
      tamper_detected: !isValid,
      message: isValid
        ? 'Cryptographic integrity verified: record is unmodified.'
        : 'SECURITY WARNING: Tamper detected! Hash mismatch.',
    };
  }
}
