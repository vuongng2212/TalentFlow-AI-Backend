import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AiUsageAction,
  AiUsageContextType,
  AiUsageDecision,
  SubscriptionPlanCode,
  SubscriptionStatus,
  WorkspaceMemberRole,
  WorkspaceMemberStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  EntitlementCheckDto,
  EntitlementContextDto,
} from './dto/entitlement-check.dto';
import {
  AI_ACTION_BY_REQUEST,
  PLAN_ORDER,
  SUBSCRIPTION_POLICY,
} from './interfaces/subscription-policy.interface';
import type {
  EntitlementDecisionResponse,
  PersonalSubscriptionStatusResponse,
  PlanResponse,
  WorkspaceSubscriptionStatusResponse,
} from './interfaces/subscription-response.interface';

@Injectable()
export class SubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  async listPlans(): Promise<PlanResponse[]> {
    return Promise.all(
      PLAN_ORDER.map(async (code) => this.mapPlan(await this.ensurePlan(code))),
    );
  }

  async ensureDefaultFreeSubscription(userId: string) {
    const freePlan = await this.ensurePlan(SubscriptionPlanCode.FREE);
    const existing = await this.prisma.userSubscription.findFirst({
      where: {
        userId,
        planId: freePlan.id,
        status: SubscriptionStatus.ACTIVE,
      },
    });

    if (existing) {
      return existing;
    }

    return this.prisma.userSubscription.create({
      data: {
        userId,
        planId: freePlan.id,
        status: SubscriptionStatus.ACTIVE,
        periodStart: new Date(),
      },
    });
  }

  async getPersonalStatus(
    userId: string,
  ): Promise<PersonalSubscriptionStatusResponse> {
    const subscription = await this.resolvePersonalSubscription(userId);
    const quota = await this.getQuotaSnapshot({
      actorId: userId,
      contextType: AiUsageContextType.PERSONAL,
      planId: subscription.plan.id,
    });

    return {
      effectivePlan: this.mapPlan(subscription.plan),
      status: subscription.status,
      periodEnd: subscription.periodEnd,
      remainingDailyQuota: Math.max(
        subscription.plan.dailyAiRequestLimit - quota.dailyUsed,
        0,
      ),
      remainingTrialQuota:
        subscription.plan.trialAiRequestLimit === null
          ? null
          : Math.max(
              subscription.plan.trialAiRequestLimit - quota.trialUsed,
              0,
            ),
    };
  }

  async activatePlus(
    userId: string,
  ): Promise<PersonalSubscriptionStatusResponse> {
    await this.ensureDefaultFreeSubscription(userId);
    const plusPlan = await this.ensurePlan(SubscriptionPlanCode.PLUS);
    const now = new Date();

    await this.prisma.userSubscription.updateMany({
      where: {
        userId,
        status: SubscriptionStatus.ACTIVE,
        plan: { code: SubscriptionPlanCode.PLUS },
      },
      data: { status: SubscriptionStatus.CANCELLED },
    });

    await this.prisma.userSubscription.create({
      data: {
        userId,
        planId: plusPlan.id,
        status: SubscriptionStatus.ACTIVE,
        periodStart: now,
        periodEnd: this.addMonths(now, 1),
      },
    });

    return this.getPersonalStatus(userId);
  }

  async activateBusiness(
    workspaceId: string,
    purchaserId: string,
  ): Promise<WorkspaceSubscriptionStatusResponse> {
    await this.ensureWorkspaceExists(workspaceId);
    await this.ensureWorkspaceAdmin(workspaceId, purchaserId);

    const businessPlan = await this.ensurePlan(SubscriptionPlanCode.BUSINESS);
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.workspaceSubscription.updateMany({
        where: {
          workspaceId,
          status: SubscriptionStatus.ACTIVE,
        },
        data: { status: SubscriptionStatus.CANCELLED },
      });

      await tx.workspaceSubscription.create({
        data: {
          workspaceId,
          purchaserId,
          planId: businessPlan.id,
          status: SubscriptionStatus.ACTIVE,
          periodStart: now,
          periodEnd: this.addMonths(now, 1),
        },
      });

      await tx.workspace.update({
        where: { id: workspaceId },
        data: { isBusiness: true },
      });
    });

    return this.getWorkspaceStatus(workspaceId, purchaserId);
  }

  async getWorkspaceStatus(
    workspaceId: string,
    requesterId: string,
  ): Promise<WorkspaceSubscriptionStatusResponse> {
    await this.ensureWorkspaceExists(workspaceId);
    await this.ensureActiveWorkspaceMember(workspaceId, requesterId);

    const subscription = await this.resolveBusinessSubscription(workspaceId);

    if (!subscription) {
      return {
        workspaceId,
        isBusinessActive: false,
        purchaserId: null,
        periodEnd: null,
        remainingDailyQuota: 0,
      };
    }

    const quota = await this.getQuotaSnapshot({
      actorId: requesterId,
      contextType: AiUsageContextType.WORKSPACE,
      workspaceId,
      planId: subscription.plan.id,
    });

    return {
      workspaceId,
      isBusinessActive: true,
      purchaserId: subscription.purchaserId,
      periodEnd: subscription.periodEnd,
      remainingDailyQuota: Math.max(
        subscription.plan.dailyAiRequestLimit - quota.dailyUsed,
        0,
      ),
    };
  }

  async hasActiveBusinessEntitlement(workspaceId: string): Promise<boolean> {
    const subscription = await this.resolveBusinessSubscription(workspaceId);
    return Boolean(subscription);
  }

  async checkEntitlement(
    userId: string,
    dto: EntitlementCheckDto,
  ): Promise<EntitlementDecisionResponse> {
    const action = AI_ACTION_BY_REQUEST[dto.action];

    if (!action) {
      throw new BadRequestException('Unsupported AI action');
    }

    if (dto.contextType === EntitlementContextDto.WORKSPACE) {
      if (!dto.workspaceId) {
        throw new BadRequestException('workspaceId is required');
      }

      return this.checkWorkspaceEntitlement(
        userId,
        dto.workspaceId,
        dto.action,
        action,
        dto.consume === true,
      );
    }

    return this.checkPersonalEntitlement(
      userId,
      dto.action,
      action,
      dto.consume === true,
    );
  }

  private async checkPersonalEntitlement(
    userId: string,
    requestedAction: EntitlementCheckDto['action'],
    action: AiUsageAction,
    consume: boolean,
  ): Promise<EntitlementDecisionResponse> {
    const subscription = await this.resolvePersonalSubscription(userId);
    const quota = await this.getQuotaSnapshot({
      actorId: userId,
      contextType: AiUsageContextType.PERSONAL,
      planId: subscription.plan.id,
    });
    const baseDecision = this.createDecision({
      contextType: 'personal',
      planName: subscription.plan.name as 'Free' | 'Plus' | 'Business',
      action: requestedAction,
      dailyLimit: subscription.plan.dailyAiRequestLimit,
      dailyUsed: quota.dailyUsed,
      trialLimit: subscription.plan.trialAiRequestLimit,
      trialUsed: quota.trialUsed,
    });
    const reason =
      this.getPlanPermissionDenyReason(subscription.plan, action) ??
      this.getQuotaDenyReason(baseDecision);

    if (reason) {
      await this.recordUsageDecision({
        actorId: userId,
        contextType: AiUsageContextType.PERSONAL,
        planId: subscription.plan.id,
        action,
        decision: AiUsageDecision.DENIED,
        denyReason: reason,
      });

      return { ...baseDecision, allowed: false, reason };
    }

    if (consume) {
      await this.recordUsageDecision({
        actorId: userId,
        contextType: AiUsageContextType.PERSONAL,
        planId: subscription.plan.id,
        action,
        decision: AiUsageDecision.ALLOWED,
      });
      return {
        ...baseDecision,
        remainingDailyQuota: Math.max(baseDecision.remainingDailyQuota - 1, 0),
        remainingTrialQuota:
          baseDecision.remainingTrialQuota === null
            ? null
            : Math.max(baseDecision.remainingTrialQuota - 1, 0),
      };
    }

    return baseDecision;
  }

  private async checkWorkspaceEntitlement(
    userId: string,
    workspaceId: string,
    requestedAction: EntitlementCheckDto['action'],
    action: AiUsageAction,
    consume: boolean,
  ): Promise<EntitlementDecisionResponse> {
    await this.ensureActiveWorkspaceMember(workspaceId, userId);
    const businessPlan = await this.ensurePlan(SubscriptionPlanCode.BUSINESS);
    const subscription = await this.resolveBusinessSubscription(workspaceId);

    if (!subscription) {
      const decision = this.createDecision({
        contextType: 'workspace',
        planName: 'Business',
        action: requestedAction,
        dailyLimit: businessPlan.dailyAiRequestLimit,
        dailyUsed: businessPlan.dailyAiRequestLimit,
        trialLimit: null,
        trialUsed: 0,
      });

      await this.recordUsageDecision({
        actorId: userId,
        contextType: AiUsageContextType.WORKSPACE,
        workspaceId,
        planId: businessPlan.id,
        action,
        decision: AiUsageDecision.DENIED,
        denyReason: 'business_required',
      });

      return { ...decision, allowed: false, reason: 'business_required' };
    }

    const quota = await this.getQuotaSnapshot({
      actorId: userId,
      contextType: AiUsageContextType.WORKSPACE,
      workspaceId,
      planId: subscription.plan.id,
    });
    const baseDecision = this.createDecision({
      contextType: 'workspace',
      planName: subscription.plan.name as 'Free' | 'Plus' | 'Business',
      action: requestedAction,
      dailyLimit: subscription.plan.dailyAiRequestLimit,
      dailyUsed: quota.dailyUsed,
      trialLimit: null,
      trialUsed: 0,
    });
    const reason =
      this.getPlanPermissionDenyReason(subscription.plan, action) ??
      this.getQuotaDenyReason(baseDecision);

    if (reason) {
      await this.recordUsageDecision({
        actorId: userId,
        contextType: AiUsageContextType.WORKSPACE,
        workspaceId,
        planId: subscription.plan.id,
        action,
        decision: AiUsageDecision.DENIED,
        denyReason: reason,
      });

      return { ...baseDecision, allowed: false, reason };
    }

    if (consume) {
      await this.recordUsageDecision({
        actorId: userId,
        contextType: AiUsageContextType.WORKSPACE,
        workspaceId,
        planId: subscription.plan.id,
        action,
        decision: AiUsageDecision.ALLOWED,
      });
      return {
        ...baseDecision,
        remainingDailyQuota: Math.max(baseDecision.remainingDailyQuota - 1, 0),
      };
    }

    return baseDecision;
  }

  private async resolvePersonalSubscription(userId: string) {
    await this.expirePersonalSubscriptions(userId);
    await this.ensureDefaultFreeSubscription(userId);

    const paid = await this.prisma.userSubscription.findFirst({
      where: {
        userId,
        status: SubscriptionStatus.ACTIVE,
        periodEnd: { gt: new Date() },
        plan: { code: SubscriptionPlanCode.PLUS },
      },
      include: { plan: true },
      orderBy: { periodEnd: 'desc' },
    });

    if (paid) {
      return paid;
    }

    const free = await this.prisma.userSubscription.findFirst({
      where: {
        userId,
        status: SubscriptionStatus.ACTIVE,
        plan: { code: SubscriptionPlanCode.FREE },
      },
      include: { plan: true },
      orderBy: { createdAt: 'asc' },
    });

    if (!free) {
      throw new NotFoundException('Free subscription could not be resolved');
    }

    return free;
  }

  private async resolveBusinessSubscription(workspaceId: string) {
    await this.expireWorkspaceSubscriptions(workspaceId);

    return this.prisma.workspaceSubscription.findFirst({
      where: {
        workspaceId,
        status: SubscriptionStatus.ACTIVE,
        periodEnd: { gt: new Date() },
        plan: { code: SubscriptionPlanCode.BUSINESS },
      },
      include: { plan: true },
      orderBy: { periodEnd: 'desc' },
    });
  }

  private async ensurePlan(code: SubscriptionPlanCode) {
    const policy = SUBSCRIPTION_POLICY[code];

    return this.prisma.subscriptionPlan.upsert({
      where: { code },
      update: {
        name: policy.name,
        scope: policy.scope,
        billingPeriod: policy.billingPeriod,
        dailyAiRequestLimit: policy.dailyAiRequestLimit,
        trialAiRequestLimit: policy.trialAiRequestLimit,
        canScoreCv: policy.canScoreCv,
        canAnalyzeCvFit: policy.canAnalyzeCvFit,
        canActivateWorkspace: policy.canActivateWorkspace,
        isActive: true,
      },
      create: {
        code,
        name: policy.name,
        scope: policy.scope,
        billingPeriod: policy.billingPeriod,
        dailyAiRequestLimit: policy.dailyAiRequestLimit,
        trialAiRequestLimit: policy.trialAiRequestLimit,
        canScoreCv: policy.canScoreCv,
        canAnalyzeCvFit: policy.canAnalyzeCvFit,
        canActivateWorkspace: policy.canActivateWorkspace,
        isActive: true,
      },
    });
  }

  private async ensureWorkspaceExists(workspaceId: string) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true },
    });

    if (!workspace) {
      throw new NotFoundException(`Workspace with ID ${workspaceId} not found`);
    }
  }

  private async ensureActiveWorkspaceMember(
    workspaceId: string,
    userId: string,
  ) {
    const membership = await this.prisma.workspaceMember.findFirst({
      where: {
        workspaceId,
        userId,
        status: WorkspaceMemberStatus.ACTIVE,
      },
      select: { id: true },
    });

    if (!membership) {
      throw new ForbiddenException('You are not a member of this workspace');
    }

    return membership;
  }

  private async ensureWorkspaceAdmin(workspaceId: string, userId: string) {
    const membership = await this.prisma.workspaceMember.findFirst({
      where: {
        workspaceId,
        userId,
        status: WorkspaceMemberStatus.ACTIVE,
      },
      select: { id: true, role: true },
    });

    if (!membership) {
      throw new ForbiddenException('You are not a member of this workspace');
    }

    if (
      membership.role === WorkspaceMemberRole.OWNER ||
      membership.role === WorkspaceMemberRole.ADMIN
    ) {
      return membership;
    }

    return this.prisma.workspaceMember.update({
      where: { id: membership.id },
      data: { role: WorkspaceMemberRole.ADMIN },
    });
  }

  private async expirePersonalSubscriptions(userId: string) {
    await this.prisma.userSubscription.updateMany({
      where: {
        userId,
        status: SubscriptionStatus.ACTIVE,
        periodEnd: { lt: new Date() },
      },
      data: { status: SubscriptionStatus.EXPIRED },
    });
  }

  private async expireWorkspaceSubscriptions(workspaceId: string) {
    await this.prisma.workspaceSubscription.updateMany({
      where: {
        workspaceId,
        status: SubscriptionStatus.ACTIVE,
        periodEnd: { lt: new Date() },
      },
      data: { status: SubscriptionStatus.EXPIRED },
    });
  }

  private async getQuotaSnapshot(input: {
    actorId: string;
    contextType: AiUsageContextType;
    workspaceId?: string;
    planId: string;
  }) {
    const usageDate = this.getUsageDate();
    const dailyWhere =
      input.contextType === AiUsageContextType.WORKSPACE
        ? {
            contextType: input.contextType,
            workspaceId: input.workspaceId,
            usageDate,
            decision: AiUsageDecision.ALLOWED,
          }
        : {
            actorId: input.actorId,
            contextType: input.contextType,
            usageDate,
            decision: AiUsageDecision.ALLOWED,
          };

    const [daily, trial] = await Promise.all([
      this.prisma.aiUsageRecord.aggregate({
        where: dailyWhere,
        _sum: { count: true },
      }),
      this.prisma.aiUsageRecord.aggregate({
        where: {
          actorId: input.actorId,
          contextType: AiUsageContextType.PERSONAL,
          planId: input.planId,
          action: AiUsageAction.CV_SCORE,
          decision: AiUsageDecision.ALLOWED,
        },
        _sum: { count: true },
      }),
    ]);

    return {
      dailyUsed: daily._sum.count ?? 0,
      trialUsed: trial._sum.count ?? 0,
    };
  }

  private async recordUsageDecision(input: {
    actorId: string;
    contextType: AiUsageContextType;
    workspaceId?: string;
    planId: string;
    action: AiUsageAction;
    decision: AiUsageDecision;
    denyReason?: string;
  }) {
    return this.prisma.aiUsageRecord.create({
      data: {
        actorId: input.actorId,
        contextType: input.contextType,
        workspaceId: input.workspaceId,
        planId: input.planId,
        action: input.action,
        usageDate: this.getUsageDate(),
        count: input.decision === AiUsageDecision.ALLOWED ? 1 : 0,
        decision: input.decision,
        denyReason: input.denyReason,
      },
    });
  }

  private createDecision(input: {
    contextType: 'personal' | 'workspace';
    planName: 'Free' | 'Plus' | 'Business';
    action: EntitlementCheckDto['action'];
    dailyLimit: number;
    dailyUsed: number;
    trialLimit: number | null;
    trialUsed: number;
  }): EntitlementDecisionResponse {
    return {
      allowed: true,
      contextType: input.contextType,
      resolvedPlan: input.planName,
      action: input.action,
      remainingDailyQuota: Math.max(input.dailyLimit - input.dailyUsed, 0),
      remainingTrialQuota:
        input.trialLimit === null
          ? null
          : Math.max(input.trialLimit - input.trialUsed, 0),
    };
  }

  private getPlanPermissionDenyReason(
    plan: {
      canScoreCv: boolean;
      canAnalyzeCvFit: boolean;
    },
    action: AiUsageAction,
  ): string | null {
    if (action === AiUsageAction.CV_SCORE && !plan.canScoreCv) {
      return 'feature_not_allowed';
    }

    if (action === AiUsageAction.CV_FIT_ANALYSIS && !plan.canAnalyzeCvFit) {
      return 'feature_not_allowed';
    }

    return null;
  }

  private getQuotaDenyReason(
    decision: EntitlementDecisionResponse,
  ): string | null {
    if (decision.remainingDailyQuota <= 0) {
      return 'daily_quota_exhausted';
    }

    if (
      decision.remainingTrialQuota !== null &&
      decision.remainingTrialQuota <= 0
    ) {
      return 'trial_quota_exhausted';
    }

    return null;
  }

  private mapPlan(plan: {
    code: SubscriptionPlanCode;
    name: string;
    scope: string;
    billingPeriod: string;
    dailyAiRequestLimit: number;
    trialAiRequestLimit: number | null;
    canScoreCv: boolean;
    canAnalyzeCvFit: boolean;
    canActivateWorkspace: boolean;
  }): PlanResponse {
    return {
      code: plan.code,
      name: plan.name,
      scope: plan.scope,
      billingPeriod: plan.billingPeriod,
      dailyAiRequestLimit: plan.dailyAiRequestLimit,
      trialAiRequestLimit: plan.trialAiRequestLimit,
      canScoreCv: plan.canScoreCv,
      canAnalyzeCvFit: plan.canAnalyzeCvFit,
      canActivateWorkspace: plan.canActivateWorkspace,
    };
  }

  private getUsageDate(date = new Date()) {
    return new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    );
  }

  private addMonths(date: Date, months: number) {
    const result = new Date(date);
    result.setUTCMonth(result.getUTCMonth() + months);
    return result;
  }
}
