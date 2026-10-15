/* eslint-disable @typescript-eslint/unbound-method */

import { PlanCode, WorkspaceMemberRole } from '@prisma/client';
import { WorkspaceContextService } from '../common/services/workspace-context.service';
import { ChangeSubscriptionDto } from './dto/change-subscription.dto';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';

describe('SubscriptionsController', () => {
  const subscriptionsService = {
    listPlans: jest.fn(),
    getCurrentSubscription: jest.fn(),
    changePlan: jest.fn(),
  };
  const workspaceContext = {
    getWorkspaceId: jest.fn(),
  };
  const controller = new SubscriptionsController(
    subscriptionsService as unknown as SubscriptionsService,
    workspaceContext as unknown as WorkspaceContextService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    workspaceContext.getWorkspaceId.mockReturnValue('workspace-1');
  });

  it('delegates the global plan catalogue read without resolving workspace context', async () => {
    subscriptionsService.listPlans.mockResolvedValue([{ code: PlanCode.FREE }]);

    await expect(controller.listPlans()).resolves.toEqual([
      { code: PlanCode.FREE },
    ]);
    expect(workspaceContext.getWorkspaceId).not.toHaveBeenCalled();
  });

  it('reads the subscription for the workspace resolved by the global context guard', async () => {
    subscriptionsService.getCurrentSubscription.mockResolvedValue({
      workspaceId: 'workspace-1',
    });

    await expect(controller.getCurrentSubscription()).resolves.toEqual({
      workspaceId: 'workspace-1',
    });
    expect(subscriptionsService.getCurrentSubscription).toHaveBeenCalledWith(
      'workspace-1',
    );
  });

  it('changes a plan only for the context workspace and authenticated requester', async () => {
    const dto: ChangeSubscriptionDto = { planCode: PlanCode.BUSINESS };
    subscriptionsService.changePlan.mockResolvedValue({ isBusiness: true });

    await expect(
      controller.changeCurrentSubscription({ id: 'owner-1' }, dto),
    ).resolves.toEqual({ isBusiness: true });
    expect(subscriptionsService.changePlan).toHaveBeenCalledWith(
      'workspace-1',
      'owner-1',
      PlanCode.BUSINESS,
    );
  });

  it('declares owner and administrator workspace roles for the change endpoint', () => {
    const roles = Reflect.getMetadata(
      'workspaceRoles',
      SubscriptionsController.prototype.changeCurrentSubscription,
    );

    expect(roles).toEqual([
      WorkspaceMemberRole.OWNER,
      WorkspaceMemberRole.ADMIN,
    ]);
  });
});
