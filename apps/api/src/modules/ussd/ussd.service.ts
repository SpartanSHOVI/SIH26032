import { Injectable, Logger } from '@nestjs/common';

/**
 * UssdService — *555# Feature Phone Session Handler
 *
 * Enables farmers on 2G/basic phones to access queue status, MSP rates,
 * and slot booking confirmation — with zero internet and zero smartphone needed.
 *
 * USSD (Unstructured Supplementary Service Data) works via SS7 signaling
 * on any GSM network. Cost to farmer: ₹0 (carrier-billed or free).
 *
 * Production integration:
 *   - Africa's Talking USSD Gateway (https://africastalking.com/ussd)
 *     — used by several Indian state govts for pilot USSD services
 *   - BSNLgateway / National USSD Platform (NPCI *99# infrastructure)
 *   - Route Mobile (https://www.routemobile.com/ussd)
 *
 * Session protocol (Africa's Talking / standard):
 *   POST /ussd/session
 *   Body: { sessionId, serviceCode, phoneNumber, text }
 *   text="" on first request; "1" on first menu choice; "1*2" on nested navigation
 *
 * Response format:
 *   "CON {menu text}\n1. Option\n2. Option"  ← continues session
 *   "END {final message}"                     ← terminates session
 */
@Injectable()
export class UssdService {
  private readonly logger = new Logger(UssdService.name);

  /** Menu navigation state machine — mirrors channel.controller.ts USSD menu tree */
  readonly MENU_STATES = {
    ROOT: 'ROOT',
    LANG_SELECT: 'LANG_SELECT',
    MAIN_MENU: 'MAIN_MENU',
    TOKEN_STATUS: 'TOKEN_STATUS',
    SLOT_INFO: 'SLOT_INFO',
    MSP_RATES: 'MSP_RATES',
    GRACE_REQUEST: 'GRACE_REQUEST',
  } as const;

  /**
   * Handle an incoming USSD session request.
   * Routes navigation based on the dot-separated path in `text`.
   *
   * @param sessionId  - Unique carrier session ID (stable per USSD session)
   * @param phoneNumber - Farmer's MSISDN (e.g. "+919876543210")
   * @param text        - Navigation path, e.g. "" | "1" | "1*2" | "1*2*1"
   * @returns USSD response string starting with "CON " or "END "
   */
  async handleSession(params: {
    sessionId: string;
    phoneNumber: string;
    serviceCode: string;
    text: string;
  }): Promise<string> {
    this.logger.log(`[USSD] Session ${params.sessionId} | Phone: ${params.phoneNumber} | Path: "${params.text}"`);

    // Full routing is implemented in channel.controller.ts at POST /channel/ussd/dial
    // This service class is the architectural home for USSD session management.
    // TODO: Migrate routing from channel.controller.ts into this service
    //       and update ChannelController to delegate to UssdService.

    const steps = params.text ? params.text.split('*') : [];

    if (steps.length === 0) {
      return 'CON AnnSetu Kisan Seva (*555#)\n1. Hindi\n2. Punjabi\n3. Marathi\n4. English';
    }

    return 'END Service temporarily unavailable. Please retry or call 1800-180-SETU.';
  }

  /**
   * Push a proactive USSD notification to a farmer's phone (MT-USSD).
   * Used to notify farmers when their token number is called.
   *
   * Note: MT-USSD (Mobile Terminated) requires carrier agreement and
   * TRAI approval for bulk use. For SIH demo: simulated only.
   */
  async sendMtUssd(params: {
    phoneNumber: string;
    message: string;
  }): Promise<{ status: 'sent' | 'simulated' }> {
    this.logger.log(`[USSD MT] → ${params.phoneNumber} | Msg: ${params.message.slice(0, 40)}...`);
    // TODO: POST to Africa's Talking /v1/ussd/mt or NPCI MT endpoint
    return { status: 'simulated' };
  }
}
