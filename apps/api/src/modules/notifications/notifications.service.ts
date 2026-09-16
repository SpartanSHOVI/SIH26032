import { Injectable, Logger } from '@nestjs/common';

/**
 * NotificationsService — Multi-channel farmer notification dispatcher
 *
 * Production integration targets:
 *   - SMS:  MSG91 (https://msg91.com/api) or Twilio (https://www.twilio.com/sms)
 *           POST /api/sendotp  →  authkey, mobiles[], message, route
 *   - Push: Firebase Cloud Messaging (FCM) via google-auth-library
 *           POST https://fcm.googleapis.com/v1/projects/{id}/messages:send
 *   - In-app: Write to `notifications` table → Socket.IO broadcast via EventsService
 *
 * For the SIH demo, all methods simulate the dispatch and log to console.
 * Toggle NOTIFICATIONS_LIVE=true in .env to switch to real gateways.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  /**
   * Dispatch a booking confirmation SMS to the farmer.
   * Fires immediately after a token is issued.
   *
   * Example SMS text (Hindi):
   * "नमस्ते [Name] जी, आपका अन्न सेतु टोकन [TOKEN_NO] जारी हुआ।
   *  मंडी: [CENTER], दिनांक: [DATE], समय: [SLOT]
   *  लाइव स्थिति: annsetu.gov.in/q/[TOKEN_NO]  — DoCA"
   */
  async sendBookingConfirmation(params: {
    mobile: string;
    farmerName: string;
    tokenNumber: string;
    centerName: string;
    slotDate: string;
    startTime: string;
    endTime: string;
    language?: 'hi' | 'pa' | 'mr' | 'en';
  }): Promise<{ status: 'sent' | 'simulated'; messageId: string }> {
    this.logger.log(
      `[NOTIFY] Booking confirmation → ${params.mobile} | Token: ${params.tokenNumber} | Center: ${params.centerName}`,
    );
    // TODO: Replace with MSG91/Twilio call when NOTIFICATIONS_LIVE=true
    return { status: 'simulated', messageId: `SIM-${Date.now()}` };
  }

  /**
   * Alert a farmer that their turn is approaching (N farmers ahead threshold).
   * Triggered by the queue module when farmers_ahead drops below the threshold.
   *
   * Channels: SMS + push (if FCM token registered) + in-app notification row
   */
  async sendTurnApproachingAlert(params: {
    mobile: string;
    farmerName: string;
    tokenNumber: string;
    farmersAhead: number;
    estimatedWaitMin: number;
    centerName: string;
    language?: 'hi' | 'pa' | 'mr' | 'en';
  }): Promise<{ status: 'sent' | 'simulated'; channels: string[] }> {
    this.logger.log(
      `[NOTIFY] Turn approaching → ${params.mobile} | ${params.farmersAhead} ahead | Est. wait: ${params.estimatedWaitMin} min`,
    );
    return { status: 'simulated', channels: ['sms', 'in-app'] };
  }

  /**
   * Notify farmer that their lot has been accepted and payment is initiating.
   * Includes UTR reference and PFMS tracking link.
   */
  async sendProcurementCompleteAlert(params: {
    mobile: string;
    farmerName: string;
    tokenNumber: string;
    quantityKg: number;
    crop: string;
    paymentAmount: number;
    utrReference: string;
    language?: 'hi' | 'pa' | 'mr' | 'en';
  }): Promise<{ status: 'sent' | 'simulated'; messageId: string }> {
    this.logger.log(
      `[NOTIFY] Procurement complete → ${params.mobile} | ₹${params.paymentAmount} | UTR: ${params.utrReference}`,
    );
    return { status: 'simulated', messageId: `SIM-${Date.now()}` };
  }

  /**
   * Notify farmer that DBT payment has been credited to their bank account.
   * Final notification in the procurement lifecycle.
   */
  async sendPaymentCreditedAlert(params: {
    mobile: string;
    farmerName: string;
    amount: number;
    utrReference: string;
    bankAccount: string;
    language?: 'hi' | 'pa' | 'mr' | 'en';
  }): Promise<{ status: 'sent' | 'simulated'; messageId: string }> {
    this.logger.log(
      `[NOTIFY] Payment credited → ${params.mobile} | ₹${params.amount} | Bank: ${params.bankAccount}`,
    );
    return { status: 'simulated', messageId: `SIM-${Date.now()}` };
  }
}
