/* eslint-disable @typescript-eslint/unbound-method */
import { ForbiddenException } from '@nestjs/common';
import {
  AiUsageAction,
  AiUsageContextType,
  AiUsageDecision,
  BillingPeriod,
  SubscriptionPlanCode,
  SubscriptionPlanScope,
  SubscriptionStatus,
  WorkspaceMemberRole,
  WorkspaceMemberStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  EntitlementActionDto,
  EntitlementContextDto,
} from './dto/entitlement-check.dto';
import { SubscriptionsService } from './subscriptions.service';

type TransactionCallback = (tx: {
  workspaceSubscription: {
    updateMany: jest.Mock;
    create: jest.Mock;
  };
  workspace: {
    update: jest.Mock;
  };
}) => Promise<unknown>;

describe('SubscriptionsService', () => {
  let service: SubscriptionsService;

  const freePlan = {
    id: 'plan-free',
    code: SubscriptionPlanCode.FREE,
    name: 'Free',
    scope: SubscriptionPlanScope.PERSONAL,
    billingPeriod: BillingPeriod.NONE,
    dailyAiRequestLimit: 5,
    trialAiRequestLimit: 15,
    canScoreCv: true,
    canAnalyzeCvFit: false,
    canActivateWorkspace: false,
  };

  const plusPlan = {
    id: 'plan-plus',
    code: SubscriptionPlanCode.PLUS,
    name: 'Plus',
    scope: SubscriptionPlanScope.PERSONAL,
    billingPeriod: BillingPeriod.MONTHLY,
    dailyAiRequestLimit: 20,
    trialAiRequestLimit: null,
    canScoreCv: true,
    canAnalyzeCvFit: true,
    canActivateWorkspace: false,
  };

  const businessPlan = {
    id: 'plan-business',
    code: SubscriptionPlanCode.BUSINESS,
    name: 'Business',
    scope: SubscriptionPlanScope.WORKSPACE,
    billingPeriod: BillingPeriod.MONTHLY,
    dailyAiRequestLimit: 500,
    trialAiRequestLimit: null,
    canScoreCv: true,
    canAnalyzeCvFit: true,
    canActivateWorkspace: true,
  };

  const mockPrisma = {
    $transaction: jest.fn(),
    subscriptionPlan: {
      upsert: jest.fn(),
    },
    userSubscription: {
      findFirst: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
    },
    workspaceSubscription: {
      findFirst: jest.fn(),
      updateMany: jest.fn(),
      create: jest.fn(),
    },
    aiUsageRecord: {
      aggregate: jest.fn(),
      create: jest.fn(),
    },
    workspace: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    workspaceMember: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(() => {
    service = new SubscriptionsService(mockPrisma as unknown as PrismaService);
    mockPrisma.subscriptionPlan.upsert.mockImplementation(
      ({ where }: { where: { code: SubscriptionPlanCode } }) => {
        if (where.code === SubscriptionPlanCode.FREE) return freePlan;
        if (where.code === SubscriptionPlanCode.PLUS) return plusPlan;
        return businessPlan;
      },
    );
    mockPrisma.userSubscription.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.workspaceSubscription.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.aiUsageRecord.aggregate.mockResolvedValue({
      _sum: { count: 0 },
    });
    mockPrisma.aiUsageRecord.create.mockResolvedValue({ id: 'usage-1' });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('lists the fixed plans in product order', async () => {
    await expect(service.listPlans()).resolves.toEqual([
      expect.objectContaining({ code: SubscriptionPlanCode.FREE }),
      expect.objectContaining({ code: SubscriptionPlanCode.PLUS }),
      expect.objectContaining({ code: SubscriptionPlanCode.BUSINESS }),
    ]);
  });

  it('creates Free entitlement by default when missing', async () => {
    mockPrisma.userSubscription.findFirst.mockResolvedValue(null);
    mockPrisma.userSubscription.create.mockResolvedValue({
      id: 'sub-free',
      userId: 'user-1',
      planId: freePlan.id,
    });

    await service.ensureDefaultFreeSubscription('user-1');

    expect(mockPrisma.userSubscription.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        planId: freePlan.id,
        status: SubscriptionStatus.ACTIVE,
      }),
    });
  });

  it('allows Free CV scoring with remaining trial and daily quota', async () => {
    mockPrisma.userSubscription.findFirst
      .mockResolvedValueOnce({ id: 'sub-free' })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'sub-free',
        status: SubscriptionStatus.ACTIVE,
        periodEnd: null,
        plan: freePlan,
      });

    const decision = await service.checkEntitlement('user-1', {
      contextType: EntitlementContextDto.PERSONAL,
      action: EntitlementActionDto.CV_SCORE,
    });

    expect(decision).toMatchObject({
      allowed: true,
      resolvedPlan: 'Free',
      remainingDailyQuota: 5,
      remainingTrialQuota: 15,
    });
  });

  it('denies Free CV fit analysis and records denial without quota count', async () => {
    mockPrisma.userSubscription.findFirst
      .mockResolvedValueOnce({ id: 'sub-free' })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'sub-free',
        status: SubscriptionStatus.ACTIVE,
        periodEnd: null,
        plan: freePlan,
      });

    const decision = await service.checkEntitlement('user-1', {
      contextType: EntitlementContextDto.PERSONAL,
      action: EntitlementActionDto.CV_FIT_ANALYSIS,
      consume: true,
    });

    expect(decision).toMatchObject({
      allowed: false,
      reason: 'feature_not_allowed',
    });
    expect(mockPrisma.aiUsageRecord.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: AiUsageAction.CV_FIT_ANALYSIS,
        decision: AiUsageDecision.DENIED,
        count: 0,
      }),
    });
  });

  it('activates Plus for one monthly personal period', async () => {
    mockPrisma.userSubscription.findFirst
      .mockResolvedValueOnce({ id: 'sub-free' })
      .mockResolvedValueOnce({ id: 'sub-free' })
      .mockResolvedValueOnce({
        id: 'sub-plus',
        status: SubscriptionStatus.ACTIVE,
        periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        plan: plusPlan,
      });
    mockPrisma.userSubscription.create.mockResolvedValue({ id: 'sub-plus' });

    const status = await service.activatePlus('user-1');

    expect(mockPrisma.userSubscription.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        planId: plusPlan.id,
        status: SubscriptionStatus.ACTIVE,
        periodEnd: expect.any(Date),
      }),
    });
    expect(status.effectivePlan.code).toBe(SubscriptionPlanCode.PLUS);
    expect(status.remainingDailyQuota).toBe(20);
  });

  it('activates Business and preserves owner/admin capability', async () => {
    const tx = {
      workspaceSubscription: {
        updateMany: jest.fn(),
        create: jest.fn(),
      },
      workspace: {
        update: jest.fn(),
      },
    };
    mockPrisma.$transaction.mockImplementation(
      (callback: TransactionCallback) => callback(tx),
    );
    mockPrisma.workspace.findUnique.mockResolvedValue({ id: 'workspace-1' });
    mockPrisma.workspaceMember.findFirst
      .mockResolvedValueOnce({
        id: 'member-1',
        role: WorkspaceMemberRole.OWNER,
      })
      .mockResolvedValueOnce({ id: 'member-1' });
    mockPrisma.workspaceSubscription.findFirst.mockResolvedValue({
      id: 'workspace-sub-1',
      purchaserId: 'user-1',
      periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      plan: businessPlan,
    });

    const status = await service.activateBusiness('workspace-1', 'user-1');

    expect(tx.workspaceSubscription.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: 'workspace-1',
        purchaserId: 'user-1',
        planId: businessPlan.id,
      }),
    });
    expect(tx.workspace.update).toHaveBeenCalledWith({
      where: { id: 'workspace-1' },
      data: { isBusiness: true },
    });
    expect(status.isBusinessActive).toBe(true);
    expect(status.remainingDailyQuota).toBe(500);
  });

  it('rejects workspace entitlement when requester is not an active member', async () => {
    mockPrisma.workspaceMember.findFirst.mockResolvedValue(null);

    await expect(
      service.checkEntitlement('user-1', {
        contextType: EntitlementContextDto.WORKSPACE,
        workspaceId: 'workspace-1',
        action: EntitlementActionDto.CV_SCORE,
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('keeps Plus personal quota separate from Business workspace quota', async () => {
    mockPrisma.userSubscription.findFirst
      .mockResolvedValueOnce({ id: 'sub-free' })
      .mockResolvedValueOnce({
        id: 'sub-plus',
        status: SubscriptionStatus.ACTIVE,
        periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        plan: plusPlan,
      });
    mockPrisma.aiUsageRecord.aggregate
      .mockResolvedValueOnce({ _sum: { count: 20 } })
      .mockResolvedValueOnce({ _sum: { count: 0 } });

    const personalDecision = await service.checkEntitlement('user-1', {
      contextType: EntitlementContextDto.PERSONAL,
      action: EntitlementActionDto.CV_SCORE,
    });

    expect(personalDecision).toMatchObject({
      allowed: false,
      reason: 'daily_quota_exhausted',
      resolvedPlan: 'Plus',
    });

    mockPrisma.workspaceMember.findFirst.mockResolvedValue({
      id: 'member-1',
      status: WorkspaceMemberStatus.ACTIVE,
    });
    mockPrisma.workspaceSubscription.findFirst.mockResolvedValue({
      id: 'workspace-sub-1',
      purchaserId: 'owner-1',
      periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      plan: businessPlan,
    });
    mockPrisma.aiUsageRecord.aggregate
      .mockResolvedValueOnce({ _sum: { count: 0 } })
      .mockResolvedValueOnce({ _sum: { count: 0 } });

    const workspaceDecision = await service.checkEntitlement('user-1', {
      contextType: EntitlementContextDto.WORKSPACE,
      workspaceId: 'workspace-1',
      action: EntitlementActionDto.CV_SCORE,
    });

    expect(workspaceDecision).toMatchObject({
      allowed: true,
      resolvedPlan: 'Business',
      remainingDailyQuota: 500,
    });
  });
});
