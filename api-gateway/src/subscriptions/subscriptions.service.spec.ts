/* eslint-disable @typescript-eslint/unbound-method */

import { ForbiddenException, Logger, NotFoundException } from '@nestjs/common';
import {
  PlanCode,
  PrismaClient,
  SubscriptionStatus,
  WorkspaceMemberRole,
  WorkspaceMemberStatus,
} from '@prisma/client';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionsService } from './subscriptions.service';

describe('SubscriptionsService', () => {
  let service: SubscriptionsService;
  let prisma: DeepMockProxy<PrismaClient>;

  const freePlan = {
    id: 'plan-free',
    code: PlanCode.FREE,
    name: 'Free',
    displayOrder: 1,
    isActive: true,
    enablesBusiness: false,
  };

  const businessPlan = {
    id: 'plan-business',
    code: PlanCode.BUSINESS,
    name: 'Business',
    displayOrder: 3,
    isActive: true,
    enablesBusiness: true,
  };

  const currentSubscription = {
    id: 'subscription-1',
    workspaceId: 'workspace-1',
    planId: freePlan.id,
    status: SubscriptionStatus.ACTIVE,
    startedAt: new Date('2026-09-16T08:00:00.000Z'),
    createdAt: new Date('2026-09-16T08:00:00.000Z'),
    updatedAt: new Date('2026-09-16T08:00:00.000Z'),
    plan: freePlan,
  };

  beforeEach(() => {
    prisma = mockDeep<PrismaClient>();
    service = new SubscriptionsService(prisma as unknown as PrismaService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('provisionFreeForWorkspace', () => {
    it('uses the supplied transaction client to create one active Free subscription', async () => {
      const transaction = {
        plan: {
          findFirst: jest.fn().mockResolvedValue(freePlan),
        },
        subscription: {
          create: jest.fn().mockResolvedValue(currentSubscription),
        },
      };

      await expect(
        service.provisionFreeForWorkspace(transaction as never, 'workspace-1'),
      ).resolves.toEqual(currentSubscription);

      expect(transaction.plan.findFirst).toHaveBeenCalledWith({
        where: { code: PlanCode.FREE, isActive: true },
      });
      expect(transaction.subscription.create).toHaveBeenCalledWith({
        data: {
          workspaceId: 'workspace-1',
          planId: freePlan.id,
          status: SubscriptionStatus.ACTIVE,
        },
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('fails without creating a subscription when the canonical Free plan is unavailable', async () => {
      const transaction = {
        plan: { findFirst: jest.fn().mockResolvedValue(null) },
        subscription: { create: jest.fn() },
      };

      await expect(
        service.provisionFreeForWorkspace(transaction as never, 'workspace-1'),
      ).rejects.toThrow(NotFoundException);
      expect(transaction.subscription.create).not.toHaveBeenCalled();
    });
  });

  describe('listPlans', () => {
    it('returns active plans in ascending display order without persistence identifiers', async () => {
      prisma.plan.findMany.mockResolvedValue([freePlan, businessPlan] as never);

      await expect(service.listPlans()).resolves.toEqual([
        freePlan,
        businessPlan,
      ]);
      expect(prisma.plan.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: { displayOrder: 'asc' },
        select: {
          code: true,
          name: true,
          displayOrder: true,
          isActive: true,
          enablesBusiness: true,
        },
      });
    });
  });

  describe('getCurrentSubscription', () => {
    it('returns the current subscription with selected plan and derived Business entitlement', async () => {
      prisma.subscription.findUnique.mockResolvedValue(currentSubscription);

      await expect(
        service.getCurrentSubscription('workspace-1'),
      ).resolves.toEqual({
        ...currentSubscription,
        isBusiness: false,
      });
      expect(prisma.subscription.findUnique).toHaveBeenCalledWith({
        where: { workspaceId: 'workspace-1' },
        include: {
          plan: {
            select: {
              code: true,
              name: true,
              displayOrder: true,
              isActive: true,
              enablesBusiness: true,
            },
          },
        },
      });
    });

    it('throws a data-integrity 404 when the resolved workspace has no subscription', async () => {
      prisma.subscription.findUnique.mockResolvedValue(null);

      await expect(
        service.getCurrentSubscription('workspace-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('changePlan', () => {
    const mockTransaction = (overrides: Record<string, unknown> = {}) => {
      const transaction = {
        workspaceMember: {
          findFirst: jest.fn().mockResolvedValue({
            role: WorkspaceMemberRole.OWNER,
          }),
        },
        plan: {
          findFirst: jest.fn().mockResolvedValue(businessPlan),
        },
        subscription: {
          findUnique: jest.fn().mockResolvedValue(currentSubscription),
          update: jest.fn().mockResolvedValue({
            ...currentSubscription,
            planId: businessPlan.id,
            plan: businessPlan,
          }),
        },
        workspace: {
          update: jest.fn().mockResolvedValue({ id: 'workspace-1' }),
        },
        ...overrides,
      };

      prisma.$transaction.mockImplementation((callback) =>
        callback(transaction),
      );

      return transaction;
    };

    it('authorizes an active owner and atomically changes the subscription and entitlement', async () => {
      const transaction = mockTransaction();
      const log = jest.spyOn(Logger.prototype, 'log').mockImplementation();

      await expect(
        service.changePlan('workspace-1', 'owner-1', PlanCode.BUSINESS),
      ).resolves.toEqual({
        ...currentSubscription,
        planId: businessPlan.id,
        plan: businessPlan,
        isBusiness: true,
      });

      expect(transaction.workspaceMember.findFirst).toHaveBeenCalledWith({
        where: {
          workspaceId: 'workspace-1',
          userId: 'owner-1',
          status: WorkspaceMemberStatus.ACTIVE,
          role: { in: [WorkspaceMemberRole.OWNER, WorkspaceMemberRole.ADMIN] },
        },
        select: { role: true },
      });
      expect(transaction.subscription.update).toHaveBeenCalledWith({
        where: { workspaceId: 'workspace-1' },
        data: { planId: businessPlan.id },
        include: {
          plan: {
            select: {
              code: true,
              name: true,
              displayOrder: true,
              isActive: true,
              enablesBusiness: true,
            },
          },
        },
      });
      expect(transaction.workspace.update).toHaveBeenCalledWith({
        where: { id: 'workspace-1' },
        data: { isBusiness: true },
      });
      expect(log).toHaveBeenCalledWith(
        expect.stringContaining('workspaceId=workspace-1'),
      );
    });

    it('rejects a requester without an active owner or administrator membership before any write', async () => {
      const transaction = mockTransaction({
        workspaceMember: { findFirst: jest.fn().mockResolvedValue(null) },
      });

      await expect(
        service.changePlan('workspace-1', 'recruiter-1', PlanCode.BUSINESS),
      ).rejects.toThrow(ForbiddenException);
      expect(transaction.plan.findFirst).not.toHaveBeenCalled();
      expect(transaction.subscription.update).not.toHaveBeenCalled();
      expect(transaction.workspace.update).not.toHaveBeenCalled();
    });

    it('rejects an unavailable or unknown plan without changing the current subscription', async () => {
      const transaction = mockTransaction({
        plan: { findFirst: jest.fn().mockResolvedValue(null) },
      });

      await expect(
        service.changePlan('workspace-1', 'owner-1', PlanCode.PLUS),
      ).rejects.toThrow(NotFoundException);
      expect(transaction.subscription.update).not.toHaveBeenCalled();
      expect(transaction.workspace.update).not.toHaveBeenCalled();
    });

    it('returns the existing subscription for an idempotent same-plan selection', async () => {
      const transaction = mockTransaction({
        plan: { findFirst: jest.fn().mockResolvedValue(freePlan) },
      });

      await expect(
        service.changePlan('workspace-1', 'owner-1', PlanCode.FREE),
      ).resolves.toEqual({ ...currentSubscription, isBusiness: false });
      expect(transaction.subscription.update).not.toHaveBeenCalled();
      expect(transaction.workspace.update).not.toHaveBeenCalled();
    });

    it('does not report success when the transaction fails while synchronizing the workspace entitlement', async () => {
      const transaction = mockTransaction({
        workspace: {
          update: jest.fn().mockRejectedValue(new Error('database failure')),
        },
      });

      await expect(
        service.changePlan('workspace-1', 'owner-1', PlanCode.BUSINESS),
      ).rejects.toThrow('database failure');
      expect(transaction.subscription.update).toHaveBeenCalled();
    });
  });
});
