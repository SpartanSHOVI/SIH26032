import { Body, Controller, Get, Inject, Param, Patch, Post, Query, Req, Res } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { Actor, Public } from '../../common/decorators/access';
import { Principal } from './auth.types';
import { AuthService } from './auth.service';
import { DemoOtpRequestDto, DemoOtpVerifyDto, LoginDto, RegisterDto, UpdateFarmerDto } from './auth.dto';

@ApiTags('Auth')
@Controller()
export class AuthController {
  constructor(@Inject(AuthService) private auth: AuthService) {}

  @Public()
  @ApiOperation({ summary: 'Log in with mobile/password (Argon2 verified with automatic legacy SHA-256 upgrade)' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 200, description: 'Authentication cookie issued, returns user profile' })
  @Post(['auth/login', 'centers/operator/login'])
  login(@Body() b: Record<string, unknown>, @Res({ passthrough: true }) r: Response) {
    return this.auth.login(b, r);
  }

  @Public()
  @ApiOperation({ summary: 'Register a new farmer account (password hashed directly with Argon2)' })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({ status: 201, description: 'Farmer registered and session cookies issued' })
  @Post('auth/register')
  register(@Body() b: Record<string, unknown>, @Res({ passthrough: true }) r: Response) {
    return this.auth.register(b, r);
  }

  @ApiOperation({ summary: 'Get current authenticated user profile' })
  @ApiResponse({ status: 200, description: 'User profile with role-specific details' })
  @Get('auth/profile')
  profile(@Actor() p: Principal) {
    return this.auth.profile(p);
  }

  @Public()
  @ApiOperation({ summary: 'Lookup farmer profile by registered mobile number' })
  @ApiQuery({ name: 'mobile', example: '9876543210' })
  @ApiResponse({ status: 200, description: 'Farmer demographic record' })
  @Get('farmers/lookup')
  lookup(@Query('mobile') mobile: string) {
    return this.auth.lookupMobile(mobile);
  }

  @Public()
  @ApiOperation({ summary: 'Get farmer profile by UUID' })
  @ApiParam({ name: 'id', description: 'Farmer UUID' })
  @ApiResponse({ status: 200, description: 'Farmer record' })
  @Get('farmers/:id')
  farmer(@Param('id') id: string) {
    return this.auth.farmerById(id);
  }

  @ApiOperation({ summary: 'Update farmer demographic and preference information' })
  @ApiParam({ name: 'id', required: false, description: 'Optional farmer UUID' })
  @ApiBody({ type: UpdateFarmerDto })
  @ApiResponse({ status: 200, description: 'Updated farmer profile' })
  @Patch(['auth/profile', 'farmers/:id'])
  update(@Param('id') id: string | undefined, @Actor() p: Principal, @Body() b: Record<string, unknown>) {
    return this.auth.updateFarmer(id || p.farmerId!, b);
  }

  @Public()
  @ApiOperation({ summary: 'Refresh session tokens using rotating refresh cookie or body token and CSRF validation' })
  @ApiResponse({ status: 200, description: 'Session refreshed with new access and refresh tokens' })
  @Post('auth/refresh')
  refresh(@Req() q: Request, @Body() b: Record<string, unknown>, @Res({ passthrough: true }) r: Response) {
    // Explicit role-session credentials take precedence over ambient browser cookies.
    // This allows farmer, center and admin sessions to coexist in separate tabs.
    const raw = (typeof b?.refreshToken === 'string' ? b.refreshToken : '') || (typeof b?.refresh === 'string' ? b.refresh : '') || q.cookies?.annsetu_refresh;
    const csrf = String(b?.csrfToken || b?.csrf || q.headers['x-csrf-token'] || '');
    return this.auth.refresh(raw, csrf, r);
  }

  @ApiOperation({ summary: 'Sign out and revoke active session' })
  @ApiResponse({ status: 200, description: 'Signed out and cookies cleared' })
  @Post('auth/logout')
  logout(@Actor() p: Principal, @Res({ passthrough: true }) r: Response) {
    return this.auth.logout(p, r);
  }

  @Public()
  @ApiOperation({ summary: 'Request simulated demo OTP (gated behind DEMO_AUTH / DEMO_MODE)' })
  @ApiBody({ type: DemoOtpRequestDto })
  @ApiResponse({ status: 200, description: 'Simulated OTP returned in demo mode' })
  @Post(['auth/request-otp', 'auth/send-otp'])
  otp(@Body() b: Record<string, string>) {
    return this.auth.demoOtp(b.mobile, undefined);
  }

  @Public()
  @ApiOperation({ summary: 'Verify demo OTP and issue session cookies' })
  @ApiBody({ type: DemoOtpVerifyDto })
  @ApiResponse({ status: 200, description: 'Authentication cookies issued' })
  @Post('auth/verify-otp')
  verify(@Body() b: Record<string, string>, @Res({ passthrough: true }) r: Response) {
    return this.auth.demoOtp(b.mobile, b.otp, r);
  }
}
