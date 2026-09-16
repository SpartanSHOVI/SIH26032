import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ type: String, example: '9876543210', description: 'Farmer mobile, center code, or operator ID' })
  login?: string;

  @ApiProperty({ type: String, example: 'Farmer@123', description: 'Password or PIN' })
  password?: string;

  @ApiProperty({ type: String, required: false, example: '9876543210', description: 'Alternative mobile parameter' })
  mobile?: string;

  @ApiProperty({ type: String, required: false, example: 'CEN-001', description: 'Center code for operator login' })
  center_code?: string;
}

export class RegisterDto {
  @ApiProperty({ type: String, example: 'Gurpreet Singh', description: 'Full legal name of the farmer' })
  name!: string;

  @ApiProperty({ type: String, example: '9876543210', description: '10-digit mobile number' })
  mobile!: string;

  @ApiProperty({ type: String, example: 'Farmer@1234', description: 'Password (min 8 chars, stored with Argon2)' })
  password!: string;

  @ApiProperty({ type: Boolean, example: true, description: 'DPDP consent acceptance' })
  consent!: true;

  @ApiProperty({ type: String, required: false, example: 'Punjab' })
  state?: string;

  @ApiProperty({ type: String, required: false, example: 'Ludhiana' })
  district?: string;

  @ApiProperty({ type: String, required: false, example: 'Village Khanna' })
  address?: string;

  @ApiProperty({ type: String, required: false, example: 'Wheat', default: 'Wheat' })
  crop?: string;

  @ApiProperty({ type: Number, required: false, example: 35.0, default: 30 })
  quantity?: number;

  @ApiProperty({ type: String, required: false, example: 'pa', default: 'English' })
  language?: string;

  @ApiProperty({ type: String, required: false, example: '11111111-2222-3333-4444-555555555551' })
  preferred_center_id?: string;

  @ApiProperty({ type: String, required: false, example: '987654321001' })
  bank_account?: string;

  @ApiProperty({ type: String, required: false, example: 'SBIN0001234' })
  ifsc?: string;
}

export class DemoOtpRequestDto {
  @ApiProperty({ type: String, example: '9876543210', description: '10-digit mobile number' })
  mobile!: string;
}

export class DemoOtpVerifyDto {
  @ApiProperty({ type: String, example: '9876543210', description: '10-digit mobile number' })
  mobile!: string;

  @ApiProperty({ type: String, example: '123456', description: '6-digit OTP code' })
  otp!: string;
}

export class UpdateFarmerDto {
  @ApiProperty({ type: String, required: false, example: 'Gurpreet Singh' })
  name?: string;

  @ApiProperty({ type: String, required: false, example: 'Punjab' })
  state?: string;

  @ApiProperty({ type: String, required: false, example: 'Ludhiana' })
  district?: string;

  @ApiProperty({ type: String, required: false, example: 'Wheat' })
  crop?: string;

  @ApiProperty({ type: Number, required: false, example: 50 })
  quantity?: number;

  @ApiProperty({ type: String, required: false, example: 'pa' })
  language?: string;
}

