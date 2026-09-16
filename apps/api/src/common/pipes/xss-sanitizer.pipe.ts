import { Injectable, PipeTransform, ArgumentMetadata } from '@nestjs/common';

/**
 * Strips script tags, javascript: pseudoprotocols, event handlers,
 * and dangerous HTML tags to prevent XSS attacks across incoming payloads.
 */
export function sanitizeXss(value: unknown): unknown {
  if (typeof value === 'string') {
    return value
      // Remove <script>...</script> tags and contents
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      // Remove iframe, object, embed, applet tags
      .replace(/<(?:\/)?(?:iframe|object|embed|applet|meta|link)\b[^>]*>/gi, '')
      // Remove javascript: and vbscript: URIs
      .replace(/(?:javascript|vbscript|data\s*:[^;]*;base64):/gi, '')
      // Remove inline HTML event handlers like onload=, onclick=, onerror=
      .replace(/\bon\w+\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gi, '')
      // Strip standalone < and > if they form incomplete tags
      .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, '');
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeXss(item));
  }

  if (value !== null && typeof value === 'object') {
    const sanitizedObj: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      sanitizedObj[key] = sanitizeXss(val);
    }
    return sanitizedObj;
  }

  return value;
}

@Injectable()
export class XssSanitizerPipe implements PipeTransform {
  transform(value: unknown, _metadata: ArgumentMetadata) {
    if (value === undefined || value === null) {
      return value;
    }
    return sanitizeXss(value);
  }
}
