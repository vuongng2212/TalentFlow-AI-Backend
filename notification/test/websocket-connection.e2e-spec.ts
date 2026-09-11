import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { Server } from 'http';
import { AddressInfo } from 'net';
import { io, Socket } from 'socket.io-client';
import { appConfig } from '../src/config/app.config';
import { jwtConfig } from '../src/config/jwt.config';
import { EmailService } from '../src/email/email.service';
import { SendNotificationType } from '../src/notification/dto/send-notification.dto';
import { NotificationModule } from '../src/notification/notification.module';
import { NotificationService } from '../src/notification/notification.service';
import { PrismaService } from '../src/prisma/prisma.service';

type JoinUserRoomAck = {
  event: string;
  data: {
    room: string;
  };
};

describe('NotificationGateway client/server connection (e2e)', () => {
  let app: INestApplication;
  let baseUrl: string;
  let jwtService: JwtService;
  let notificationService: NotificationService;
  let previousEnv: NodeJS.ProcessEnv;
  const clients: Socket[] = [];

  const jwtAccessSecret = 'test-access-secret-change-me';

  beforeAll(async () => {
    previousEnv = { ...process.env };
    process.env.JWT_ACCESS_SECRET = jwtAccessSecret;
    process.env.JWT_EXPIRES_IN = '1d';
    process.env.WS_CORS_ORIGIN = 'http://localhost:3000';
    let pendingNotification: Record<string, unknown> = {};
    const prismaService = {
      notification: {
        create: jest
          .fn()
          .mockImplementation(({ data }: { data: Record<string, unknown> }) => {
            pendingNotification = {
              id: 'notification-id',
              applicationId: null,
              subject: null,
              recipient: null,
              templateId: null,
              templateData: null,
              metadata: null,
              externalId: null,
              isRead: false,
              readAt: null,
              sentAt: null,
              failedAt: null,
              errorMessage: null,
              expiresAt: null,
              createdAt: new Date(),
              updatedAt: new Date(),
              deletedAt: null,
              ...data,
            };
            return Promise.resolve(pendingNotification);
          }),
        update: jest
          .fn()
          .mockImplementation(({ data }: { data: Record<string, unknown> }) =>
            Promise.resolve({
              ...pendingNotification,
              ...data,
              updatedAt: new Date(),
            }),
          ),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [appConfig, jwtConfig],
        }),
        NotificationModule,
      ],
    })
      .overrideProvider(EmailService)
      .useValue({
        sendEmail: jest.fn().mockResolvedValue(undefined),
      })
      .overrideProvider(PrismaService)
      .useValue(prismaService)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.listen(0);

    const server = app.getHttpServer() as Server;
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
    notificationService = moduleFixture.get(NotificationService);
    jwtService = new JwtService({
      secret: jwtAccessSecret,
      signOptions: {
        algorithm: 'HS256',
      },
    });
  });

  afterEach(() => {
    while (clients.length > 0) {
      clients.pop()?.disconnect();
    }
  });

  afterAll(async () => {
    await app?.close();
    process.env = previousEnv;
  });

  it('connects an authenticated client and lets it join the user room', async () => {
    const client = await connectClient(createValidToken());

    expect(client.connected).toBe(true);

    const joinedUserRoom = waitForEvent<JoinUserRoomAck['data']>(
      client,
      'joinedUserRoom',
    );

    client.emit('joinUserRoom');

    await expect(joinedUserRoom).resolves.toEqual({
      room: 'user:user-123',
    });
  });

  it('pushes receiveNotification to the authenticated user room', async () => {
    const client = await connectClient(createValidToken());
    const joinedUserRoom = waitForEvent<JoinUserRoomAck['data']>(
      client,
      'joinedUserRoom',
    );

    client.emit('joinUserRoom');
    await joinedUserRoom;

    const receivedNotification = waitForEvent(client, 'receiveNotification');

    await notificationService.send(
      {
        to: 'candidate@example.com',
        subject: 'Realtime notification',
        body: 'This should reach the connected client.',
        type: SendNotificationType.EMAIL,
      },
      {
        userId: 'user-123',
        email: 'user@example.com',
        role: 'RECRUITER',
      },
    );

    const payload = (await receivedNotification) as Record<string, unknown>;

    expect(payload).toMatchObject({
      userId: 'user-123',
      channel: 'email',
      title: 'Realtime notification',
      message: 'This should reach the connected client.',
      status: 'sent',
      read: false,
    });
    expect(payload).not.toHaveProperty('recipient');
    expect(payload).not.toHaveProperty('subject');
  });

  it('rejects a client connection without a WebSocket auth token', async () => {
    await expect(connectClient()).rejects.toThrow(
      'Missing WebSocket authentication token',
    );
  });

  function createValidToken(): string {
    return jwtService.sign(
      {
        sub: 'user-123',
        email: 'user@example.com',
        role: 'RECRUITER',
      },
      { expiresIn: '1h' },
    );
  }

  function connectClient(token?: string): Promise<Socket> {
    const client = io(`${baseUrl}/notifications`, {
      auth: token ? { token } : undefined,
      forceNew: true,
      reconnection: false,
      timeout: 1000,
      transports: ['websocket'],
    });

    clients.push(client);

    return new Promise((resolve, reject) => {
      client.once('connect', () => resolve(client));
      client.once('connect_error', (error) => {
        client.disconnect();
        reject(error);
      });
    });
  }

  function waitForEvent<TPayload>(
    client: Socket,
    event: string,
  ): Promise<TPayload> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error(`Timed out waiting for ${event}`)),
        1000,
      );

      client.once(event, (payload: TPayload) => {
        clearTimeout(timeout);
        resolve(payload);
      });
    });
  }
});
