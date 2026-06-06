import { Test, TestingModule } from '@nestjs/testing';
import {
  EntitlementActionDto,
  EntitlementContextDto,
} from './dto/entitlement-check.dto';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';

describe('SubscriptionsController', () => {
  let controller: SubscriptionsController;

  const user = {
    id: 'user-1',
    email: 'user@test.com',
    role: 'RECRUITER',
    fullName: 'Test User',
  };

  const mockSubscriptionsService = {
    listPlans: jest.fn(),
    getPersonalStatus: jest.fn(),
    activatePlus: jest.fn(),
    checkEntitlement: jest.fn(),
    getWorkspaceStatus: jest.fn(),
    activateBusiness: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SubscriptionsController],
      providers: [
        {
          provide: SubscriptionsService,
          useValue: mockSubscriptionsService,
        },
      ],
    }).compile();

    controller = module.get<SubscriptionsController>(SubscriptionsController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('delegates plan listing to the subscription service', async () => {
    mockSubscriptionsService.listPlans.mockResolvedValue([]);

    await expect(controller.listPlans()).resolves.toEqual([]);
  });

  it('activates Plus for the current user', async () => {
    mockSubscriptionsService.activatePlus.mockResolvedValue({
      effectivePlan: { code: 'PLUS' },
    });

    await controller.activatePlus(user);

    expect(mockSubscriptionsService.activatePlus).toHaveBeenCalledWith(user.id);
  });

  it('checks entitlement for the current user', async () => {
    const dto = {
      contextType: EntitlementContextDto.PERSONAL,
      action: EntitlementActionDto.CV_SCORE,
      consume: true,
    };
    mockSubscriptionsService.checkEntitlement.mockResolvedValue({
      allowed: true,
    });

    await controller.checkEntitlement(user, dto);

    expect(mockSubscriptionsService.checkEntitlement).toHaveBeenCalledWith(
      user.id,
      dto,
    );
  });

  it('activates Business for a workspace', async () => {
    mockSubscriptionsService.activateBusiness.mockResolvedValue({
      isBusinessActive: true,
    });

    await controller.activateBusiness('workspace-1', user);

    expect(mockSubscriptionsService.activateBusiness).toHaveBeenCalledWith(
      'workspace-1',
      user.id,
    );
  });
});
