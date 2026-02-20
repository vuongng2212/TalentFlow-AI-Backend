import { Injectable, Logger } from '@nestjs/common';

export enum SecurityEventType {
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_FAILED = 'LOGIN_FAILED',
  LOGIN_BLOCKED = 'LOGIN_BLOCKED',
  LOGOUT = 'LOGOUT',
  TOKEN_REFRESH = 'TOKEN_REFRESH',
  TOKEN_REFRESH_FAILED = 'TOKEN_REFRESH_FAILED',
  SIGNUP = 'SIGNUP',
  PASSWORD_CHANGE = 'PASSWORD_CHANGE',
  ROLE_CHANGE = 'ROLE_CHANGE',
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
  ACCOUNT_UNLOCKED = 'ACCOUNT_UNLOCKED',
  UNAUTHORIZED_ACCESS = 'UNAUTHORIZED_ACCESS',
}

export interface SecurityAuditEvent {
  eventType: SecurityEventType;
  userId?: string;
  email?: string;
  ip?: string;
  userAgent?: string;
  details?: Record<string, unknown>;
  timestamp: Date;
}

@Injectable()
export class SecurityAuditService {
  private readonly logger = new Logger('SecurityAudit');

  log(event: Omit<SecurityAuditEvent, 'timestamp'>): void {
    const auditEvent: SecurityAuditEvent = {
      ...event,
      timestamp: new Date(),
    };

    const logMessage = this.formatLogMessage(auditEvent);

    switch (event.eventType) {
      case SecurityEventType.LOGIN_FAILED:
      case SecurityEventType.LOGIN_BLOCKED:
      case SecurityEventType.ACCOUNT_LOCKED:
      case SecurityEventType.UNAUTHORIZED_ACCESS:
      case SecurityEventType.TOKEN_REFRESH_FAILED:
        this.logger.warn(logMessage);
        break;
      default:
        this.logger.log(logMessage);
    }
  }

  private formatLogMessage(event: SecurityAuditEvent): string {
    const parts = [
      `[${event.eventType}]`,
      event.userId ? `userId=${event.userId}` : null,
      event.email ? `email=${this.maskEmail(event.email)}` : null,
      event.ip ? `ip=${event.ip}` : null,
      event.details ? `details=${JSON.stringify(event.details)}` : null,
    ].filter(Boolean);

    return parts.join(' ');
  }

  private maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!domain) return '***';

    const maskedLocal =
      local.length <= 2
        ? '*'.repeat(local.length)
        : `${local[0]}***${local[local.length - 1]}`;

    return `${maskedLocal}@${domain}`;
  }
}
