import { MailerService } from '@nestjs-modules/mailer';
import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { readFileSync } from 'fs';
import * as Handlebars from 'handlebars';
import { join } from 'path';
import { maskPii } from '../common/utils/pii-masker';
import { EmailTemplateId } from './email-template';

export type SendEmailInput = {
  to: string;
  subject: string;
  body?: string;
  templateId?: EmailTemplateId;
  templateData?: Record<string, unknown>;
};

const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 2000;

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly templateDir = join(__dirname, 'templates');

  constructor(private readonly mailerService: MailerService) {}

  async sendEmail(input: SendEmailInput): Promise<void> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const text =
          input.body ??
          (input.templateId
            ? this.renderTextTemplate(
                input.templateId,
                input.templateData ?? {},
              )
            : undefined);

        const mailOptions = {
          to: input.to,
          subject: input.subject,
          text,
          ...(input.body ? { html: input.body } : {}),
          ...(input.templateId
            ? {
                template: input.templateId,
                context: input.templateData ?? {},
              }
            : {}),
        };

        await this.mailerService.sendMail(mailOptions);

        this.logger.log(`Email sent to ${maskPii(input.to)}`);
        return;
      } catch (error) {
        lastError = error;
        const message = error instanceof Error ? error.message : String(error);

        if (attempt === MAX_ATTEMPTS) {
          break;
        }

        const delayMs = BASE_DELAY_MS * Math.pow(2, attempt - 1);
        this.logger.warn(
          `Retry ${attempt}/${MAX_ATTEMPTS} after ${delayMs / 1000}s due to: ${maskPii(message)}`,
        );
        await this.delay(delayMs);
      }
    }

    const finalMessage =
      lastError instanceof Error ? lastError.message : String(lastError);
    this.logger.error(
      `Email delivery failed after ${MAX_ATTEMPTS} attempts: ${maskPii(finalMessage)}`,
    );

    throw new ServiceUnavailableException('Email delivery failed');
  }

  private async delay(delayMs: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  private renderTextTemplate(
    templateId: EmailTemplateId,
    context: Record<string, unknown>,
  ): string {
    const source = readFileSync(
      join(this.templateDir, `${templateId}.hbs`),
      'utf8',
    );
    return Handlebars.compile(source, { strict: true })(context);
  }
}
