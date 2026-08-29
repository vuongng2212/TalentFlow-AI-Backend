import { Injectable, Inject, forwardRef, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import { CvParsingStatus, Prisma } from '@prisma/client';
import {
  RawCvParsedEvent,
  EnrichedCvParsedEvent,
  RawCvFailedEvent,
  EnrichedCvFailedEvent,
} from '../queue/interfaces/cv-events.interface';
import { sanitizeError } from '../common/utils/sanitize.util';

@Injectable()
export class CvOrchestrationService {
  private readonly logger = new Logger(CvOrchestrationService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => QueueService))
    private readonly queueService: QueueService,
  ) {}

  async handleCvParsedEvent(event: RawCvParsedEvent): Promise<void> {
    const { applicationId, aiScore, parsedData, scoringReasoning } = event;

    this.logger.log(
      `Handling cv.parsed event for application ${applicationId}`,
    );

    const application = await this.prisma.application.findFirst({
      where: { id: applicationId, deletedAt: null },
      include: {
        job: {
          select: {
            id: true,
            title: true,
            createdById: true,
            createdBy: {
              select: { email: true },
            },
          },
        },
        candidate: {
          select: { id: true, email: true, fullName: true },
        },
      },
    });

    if (!application) {
      this.logger.warn(
        `Application ${applicationId} not found for cv.parsed event`,
      );
      return;
    }

    await this.prisma.application.update({
      where: { id: applicationId },
      data: {
        cvParsingStatus: CvParsingStatus.COMPLETED,
        aiScore,
        scoringReasoning,
        parsedData: parsedData as Prisma.InputJsonValue,
      },
    });

    const recruiterEmail = await this.resolveRecruiterEmail(
      application.job.id,
      application.job.createdById,
      application.job.createdBy?.email,
    );

    if (!recruiterEmail) {
      this.logger.warn(
        `Could not find recruiter email for job ${application.job.id}, skipping success notification.`,
      );
      return;
    }

    const enrichedEvent: EnrichedCvParsedEvent = {
      applicationId,
      recruiterId: application.job.createdById,
      jobTitle: application.job.title,
      applicantEmail: application.candidate.email,
      applicantName: application.candidate.fullName,
      aiScore: aiScore || 0,
      timestamp: new Date().toISOString(),
    };

    try {
      await this.queueService.publishEnrichedCvParsed(enrichedEvent);
    } catch (error) {
      this.logger.error(
        `Failed to publish enriched cv.parsed event for application ${applicationId}`,
        sanitizeError(error),
      );
    }
  }

  async handleCvFailedEvent(event: RawCvFailedEvent): Promise<void> {
    const { applicationId, errorMessage } = event;

    this.logger.log(
      `Handling cv.failed event for application ${applicationId}`,
    );

    const application = await this.prisma.application.findFirst({
      where: { id: applicationId, deletedAt: null },
      include: {
        job: {
          select: {
            id: true,
            title: true,
            createdById: true,
            createdBy: {
              select: { email: true },
            },
          },
        },
        candidate: {
          select: { id: true, email: true, fullName: true },
        },
      },
    });

    if (!application) {
      this.logger.warn(
        `Application ${applicationId} not found for cv.failed event`,
      );
      return;
    }

    await this.prisma.application.update({
      where: { id: applicationId },
      data: {
        cvParsingStatus: CvParsingStatus.FAILED,
      },
    });

    const recruiterEmail = await this.resolveRecruiterEmail(
      application.job.id,
      application.job.createdById,
      application.job.createdBy?.email,
    );

    if (!recruiterEmail) {
      this.logger.warn(
        `Could not find recruiter email for job ${application.job.id}, skipping failure notification.`,
      );
      return;
    }

    const enrichedEvent: EnrichedCvFailedEvent = {
      applicationId,
      recruiterId: application.job.createdById,
      jobTitle: application.job.title,
      applicantEmail: application.candidate.email,
      applicantName: application.candidate.fullName,
      errorMessage: errorMessage,
      timestamp: new Date().toISOString(),
    };

    try {
      await this.queueService.publishEnrichedCvFailed(enrichedEvent);
    } catch (error) {
      this.logger.error(
        `Failed to publish enriched cv.failed event for application ${applicationId}`,
        sanitizeError(error),
      );
    }
  }

  private async resolveRecruiterEmail(
    jobId: string,
    createdById: string,
    existingEmail?: string | null,
  ): Promise<string | null> {
    if (existingEmail) {
      return existingEmail;
    }
    const recruiterUser = await this.prisma.user.findUnique({
      where: { id: createdById },
    });
    return recruiterUser?.email ?? null;
  }
}
