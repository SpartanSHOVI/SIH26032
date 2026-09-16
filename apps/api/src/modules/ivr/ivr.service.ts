import { Injectable, Logger } from '@nestjs/common';

/**
 * IvrService — Toll-Free IVR Call Router (1800-180-SETU)
 *
 * This service encapsulates the IVR state machine logic.
 * The voice prompt strings (Hindi, Punjabi, Marathi, English) live in
 * channel.controller.ts; this service handles the session routing.
 *
 * Production integration:
 *   - Exotel (https://exotel.com/apis) — recommended for Indian PSTN
 *   - Twilio Voice (https://www.twilio.com/voice)
 *   - BSNL/MTNL Government IVRS (requires NIC MeghRaj deployment)
 *
 * Flow:
 *   Farmer dials 1800-180-SETU
 *     → Language selection (1=Hindi, 2=Punjabi, 3=Marathi, 4=English)
 *     → Main menu (1=Token status, 2=Book slot, 3=Running late, 4=MSP rates, 9=Agent)
 *     → Context-aware response from DB (queue position, wait time)
 *     → DTMF navigation or agent handoff
 */
@Injectable()
export class IvrService {
  private readonly logger = new Logger(IvrService.name);

  /** Valid IVR session steps */
  readonly STEPS = [
    'IDLE',
    'CONNECTING',
    'LANGUAGE_SELECTION',
    'MAIN_MENU',
    'TOKEN_STATUS',
    'SLOT_BOOKING',
    'GRACE_PERIOD',
    'MSP_RATES',
    'AGENT_CONNECT',
    'END',
  ] as const;

  /**
   * Process a DTMF digit press at a given step.
   * Returns the next step, audio speech text, and allowed keys.
   */
  async processDigit(params: {
    callerPhone: string;
    digit: string;
    currentStep: string;
    language: 'hi' | 'pa' | 'mr' | 'en';
  }): Promise<{
    step: string;
    language: 'hi' | 'pa' | 'mr' | 'en';
    audio_speech: string;
    allowed_keys: string[];
    end_session: boolean;
  }> {
    this.logger.log(`[IVR] ${params.callerPhone} | Step: ${params.currentStep} | Digit: ${params.digit}`);

    // Session routing logic is implemented in channel.controller.ts
    // This service class is the architectural home for the business logic.
    // TODO: Move IVR routing from channel.controller.ts into this service
    //       and inject IvrService into ChannelController.

    return {
      step: 'MAIN_MENU',
      language: params.language,
      audio_speech: 'Processing your request...',
      allowed_keys: ['0', '1', '2', '3', '4', '9'],
      end_session: false,
    };
  }

  /**
   * Initiate an Outbound Dialing (OBD) call for proactive farmer notifications.
   * Used by NotificationsService to push voice alerts when token is called.
   */
  async triggerOutboundCall(params: {
    toPhone: string;
    messageText: string;
    language: 'hi' | 'pa' | 'mr' | 'en';
    retryCount?: number;
  }): Promise<{ callSid: string; status: 'initiated' | 'simulated' }> {
    this.logger.log(`[IVR OBD] → ${params.toPhone} | Lang: ${params.language}`);
    // TODO: POST to Exotel /v1/Accounts/{SID}/Calls/connect.json
    return { callSid: `SIM-${Date.now()}`, status: 'simulated' };
  }
}
