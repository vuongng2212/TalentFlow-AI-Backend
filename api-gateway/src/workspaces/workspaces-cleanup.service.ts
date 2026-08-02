import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { WorkspaceMemberStatus } from '@prisma/client';

@Injectable()
export class WorkspacesCleanupService {
  private readonly logger = new Logger(WorkspacesCleanupService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async cleanExpiredInvitations() {
    this.logger.log('Starting cleanup of expired workspace invitations...');
    try {
      const now = new Date();

      // 1. Find all expired invitations
      const expiredInvitations = await this.prisma.workspaceInvitation.findMany(
        {
          where: {
            expiresAt: { lte: now },
          },
          select: {
            workspaceId: true,
            email: true,
          },
        },
      );

      if (expiredInvitations.length === 0) {
        this.logger.log('No expired workspace invitations found.');
        return;
      }

      this.logger.log(
        `Found ${expiredInvitations.length} expired invitations.`,
      );

      // 2. Identify users corresponding to the expired invitations
      const emails = expiredInvitations.map((inv) => inv.email);
      const users = await this.prisma.user.findMany({
        where: {
          email: { in: emails },
        },
        select: {
          id: true,
          email: true,
        },
      });

      const emailToUserIdMap = new Map<string, string>(
        users.map((u) => [u.email, u.id]),
      );

      // 3. Collect workspaceMember updates
      const updates = expiredInvitations
        .map((inv) => {
          const userId = emailToUserIdMap.get(inv.email);
          if (!userId) return null;
          return {
            workspaceId: inv.workspaceId,
            userId,
          };
        })
        .filter(
          (val): val is { workspaceId: string; userId: string } => val !== null,
        );

      // 4. Deduplicate updates to prevent multiple redundant operations on the same membership
      const uniqueUpdatesMap = new Map<
        string,
        { workspaceId: string; userId: string }
      >();
      for (const update of updates) {
        const key = `${update.workspaceId}_${update.userId}`;
        uniqueUpdatesMap.set(key, update);
      }
      const uniqueUpdates = Array.from(uniqueUpdatesMap.values());

      // 5. Update the matching workspace members status in a transaction
      if (uniqueUpdates.length > 0) {
        await this.prisma.$transaction(
          uniqueUpdates.map((update) =>
            this.prisma.workspaceMember.updateMany({
              where: {
                workspaceId: update.workspaceId,
                userId: update.userId,
                status: WorkspaceMemberStatus.INVITED,
              },
              data: {
                status: WorkspaceMemberStatus.EXPIRED,
              },
            }),
          ),
        );
        this.logger.log(
          `Updated ${uniqueUpdates.length} workspace members status to EXPIRED.`,
        );
      }

      // 6. Delete the expired invitations
      const deleteResult = await this.prisma.workspaceInvitation.deleteMany({
        where: {
          expiresAt: { lte: now },
        },
      });

      this.logger.log(
        `Successfully deleted ${deleteResult.count} expired workspace invitation records.`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to clean up expired workspace invitations: ${(error as Error).message}`,
        (error as Error).stack,
      );
    }
  }
}
