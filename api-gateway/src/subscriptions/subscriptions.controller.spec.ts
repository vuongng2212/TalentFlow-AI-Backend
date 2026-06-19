import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { CreateSubscriptionCheckoutDto } from './dto/subscription-billing.dto';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';

describe('SubscriptionsController', () => {
  let controller: SubscriptionsController;

  const user = {
    id: 'user-1',
    email: 'user@test.com',
    role: Role.RECRUITER,
    fullName: 'Test User',
  };

  const mockSubscriptionsService = {
    listPlans: jest.fn(),
    getPersonalStatus: jest.fn(),
    createCheckout: jest.fn(),
    receiveMomoIpn: jest.fn(),
    confirmPaymentInternally: jest.fn(),
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

  it('delegates current subscription status to the subscription service', async () => {
    mockSubscriptionsService.getPersonalStatus.mockResolvedValue({
      currentPlan: { code: 'FREE' },
      pendingPayments: [],
    });

    await controller.getMySubscription(user);

    expect(mockSubscriptionsService.getPersonalStatus).toHaveBeenCalledWith(
      user.id,
    );
  });

  it('starts checkout for the current user', async () => {
    const dto: CreateSubscriptionCheckoutDto = { planCode: 'PLUS' };
    mockSubscriptionsService.createCheckout.mockResolvedValue({
      paymentId: 'payment-1',
    });

    await controller.createCheckout(user, dto);

    expect(mockSubscriptionsService.createCheckout).toHaveBeenCalledWith(
      user.id,
      dto,
    );
  });

  it('receives MoMo IPN payloads', async () => {
    const dto = {
      partnerCode: 'partner',
      requestId: 'request-1',
      orderId: 'order-1',
      amount: 99000,
      resultCode: 0,
      message: 'Successful.',
      responseTime: 1,
      signature: 'signature',
    };
    mockSubscriptionsService.receiveMomoIpn.mockResolvedValue({
      accepted: true,
    });

    await controller.receiveMomoIpn(dto);

    expect(mockSubscriptionsService.receiveMomoIpn).toHaveBeenCalledWith(dto);
  });

  it('confirms a verified payment internally', async () => {
    mockSubscriptionsService.confirmPaymentInternally.mockResolvedValue({
      subscriptionActivated: true,
    });

    await controller.confirmPayment(
      { paymentId: '00000000-0000-4000-8000-000000000001' },
      { note: 'verified' },
    );

    expect(
      mockSubscriptionsService.confirmPaymentInternally,
    ).toHaveBeenCalledWith('00000000-0000-4000-8000-000000000001', {
      note: 'verified',
    });
  });
});
