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
import { NotificationModule } from '../src/notification/notification.module';

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
  let previousEnv: NodeJS.ProcessEnv;
  const clients: Socket[] = [];

  const jwtAccessSecret = 'test-access-secret-change-me';

  beforeAll(async () => {
    previousEnv = { ...process.env };
    process.env.JWT_ACCESS_SECRET = jwtAccessSecret;
    process.env.JWT_EXPIRES_IN = '1d';
    process.env.WS_CORS_ORIGIN = 'http://localhost:3000';

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
      .compile();

    app = moduleFixture.createNestApplication();
    await app.listen(0);

    const server = app.getHttpServer() as Server;
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
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
