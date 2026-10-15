import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  PlanCode,
  Prisma,
  SubscriptionStatus,
  WorkspaceMemberRole,
  WorkspaceMemberStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const planSelection = {
  code: true,
  name: true,
  displayOrder: true,
  isActive: true,
  enablesBusiness: true,
} as const;

type SubscriptionWithPlan = Prisma.SubscriptionGetPayload<{
  include: { plan: { select: typeof planSelection } };
}>;

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates the default subscription with the transaction supplied by the
   * provisioning caller. It intentionally never opens a nested transaction.
   */
  async provisionFreeForWorkspace(
    transaction: Prisma.TransactionClient,
    workspaceId: string,
  ) {
    const freePlan = await transaction.plan.findFirst({
      where: { code: PlanCode.FREE, isActive: true },
    });

    if (!freePlan) {
      throw new NotFoundException('The canonical Free plan is unavailable');
    }

    return transaction.subscription.create({
      data: {
        workspaceId,
        planId: freePlan.id,
        status: SubscriptionStatus.ACTIVE,
      },
    });
  }

  async listPlans() {
    return this.prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' },
      select: planSelection,
    });
  }

  async getCurrentSubscription(workspaceId: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { workspaceId },
      include: { plan: { select: planSelection } },
    });

    if (!subscription) {
      throw new NotFoundException(
        'Current subscription was not found for the resolved workspace',
      );
    }

    return this.withEntitlement(subscription);
  }

  async changePlan(
    workspaceId: string,
    requesterId: string,
    planCode: PlanCode,
  ) {
    return this.prisma.$transaction(async (transaction) => {
      const membership = await transaction.workspaceMember.findFirst({
        where: {
          workspaceId,
          userId: requesterId,
          status: WorkspaceMemberStatus.ACTIVE,
          role: {
            in: [WorkspaceMemberRole.OWNER, WorkspaceMemberRole.ADMIN],
          },
        },
        select: { role: true },
      });

      if (!membership) {
        this.logRejection(workspaceId, requesterId, planCode, 'unauthorized');
        throw new ForbiddenException(
          'Only active workspace owners or administrators can change a plan',
        );
      }

      const selectedPlan = await transaction.plan.findFirst({
        where: { code: planCode, isActive: true },
      });

      if (!selectedPlan) {
        this.logRejection(
          workspaceId,
          requesterId,
          planCode,
          'plan_unavailable',
        );
        throw new NotFoundException('The requested plan is unavailable');
      }

      const currentSubscription = await transaction.subscription.findUnique({
        where: { workspaceId },
        include: { plan: { select: planSelection } },
      });

      if (!currentSubscription) {
        this.logRejection(
          workspaceId,
          requesterId,
          planCode,
          'subscription_missing',
        );
        throw new NotFoundException(
          'Current subscription was not found for the resolved workspace',
        );
      }

      if (currentSubscription.planId === selectedPlan.id) {
        this.logger.log(
          `subscription_plan_selection workspaceId=${workspaceId} requesterId=${requesterId} previousPlanCode=${currentSubscription.plan.code} selectedPlanCode=${planCode} outcome=idempotent`,
        );
        return this.withEntitlement(currentSubscription);
      }

      const updatedSubscription = await transaction.subscription.update({
        where: { workspaceId },
        data: { planId: selectedPlan.id },
        include: { plan: { select: planSelection } },
      });

      await transaction.workspace.update({
        where: { id: workspaceId },
        data: { isBusiness: selectedPlan.enablesBusiness },
      });

      this.logger.log(
        `subscription_plan_selection workspaceId=${workspaceId} requesterId=${requesterId} previousPlanCode=${currentSubscription.plan.code} selectedPlanCode=${selectedPlan.code} outcome=changed`,
      );

      return this.withEntitlement(updatedSubscription);
    });
  }

  private withEntitlement(subscription: SubscriptionWithPlan) {
    return {
      ...subscription,
      isBusiness: subscription.plan.enablesBusiness,
    };
  }

  private logRejection(
    workspaceId: string,
    requesterId: string,
    planCode: PlanCode,
    reason: string,
  ) {
    this.logger.warn(
      `subscription_plan_selection workspaceId=${workspaceId} requesterId=${requesterId} requestedPlanCode=${planCode} outcome=rejected reason=${reason}`,
    );
  }
}
