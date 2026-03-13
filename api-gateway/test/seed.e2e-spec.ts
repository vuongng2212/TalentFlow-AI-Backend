import { execSync } from 'child_process';
import {
  Application,
  Candidate,
  Job,
  PrismaClient,
  Role,
  User,
} from '@prisma/client';

const prisma = new PrismaClient();

const assertSafeTestDatabase = () => {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error(
      `Refusing to run destructive seed tests when NODE_ENV=${process.env.NODE_ENV}`,
    );
  }

  const databaseUrl = process.env.DATABASE_URL ?? '';
  let hostname = '';
  let dbName = '';

  try {
    const url = new URL(databaseUrl);
    hostname = url.hostname;
    dbName = url.pathname.replace(/^\//, '');
  } catch {
    throw new Error(`Invalid DATABASE_URL: ${databaseUrl}`);
  }

  const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1';
  const isTestDb = /_test\b/.test(dbName);

  if (!isLocalHost || !isTestDb) {
    throw new Error(
      `Refusing to run destructive seed tests against non-local or non-test database: ${databaseUrl}`,
    );
  }
};

const seededUserEmails = [
  'seed-admin@talentflow.invalid',
  'seed-recruiter@talentflow.invalid',
  'seed-interviewer@talentflow.invalid',
] as const;

const seededCandidateEmails = [
  'seed-alice.candidate@talentflow.invalid',
  'seed-bob.candidate@talentflow.invalid',
  'seed-charlie.candidate@talentflow.invalid',
] as const;

const seededJobTitles = [
  '__seed__senior_backend_engineer',
  '__seed__frontend_engineer',
  '__seed__devops_engineer',
] as const;

const runSeed = () => {
  execSync('pnpm db:seed', {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: {
      ...process.env,
      SEED_DEFAULT_PASSWORD:
        process.env.SEED_DEFAULT_PASSWORD ?? 'Password123!',
    },
  });
};

const cleanupSeedData = async () => {
  await prisma.application.deleteMany({
    where: {
      OR: [
        {
          candidate: {
            email: {
              in: [...seededCandidateEmails],
            },
          },
        },
        {
          job: {
            title: {
              in: [...seededJobTitles],
            },
          },
        },
      ],
    },
  });

  await prisma.job.deleteMany({
    where: {
      title: {
        in: [...seededJobTitles],
      },
      createdBy: {
        email: {
          in: [...seededUserEmails],
        },
      },
    },
  });

  await prisma.candidate.deleteMany({
    where: {
      email: {
        in: [...seededCandidateEmails],
      },
    },
  });

  await prisma.user.deleteMany({
    where: {
      email: {
        in: [...seededUserEmails],
      },
    },
  });
};

const countSeedUsers = () =>
  prisma.user.count({
    where: {
      email: {
        in: [...seededUserEmails],
      },
    },
  });

const countSeedCandidates = () =>
  prisma.candidate.count({
    where: {
      email: {
        in: [...seededCandidateEmails],
      },
    },
  });

const countSeedJobs = () =>
  prisma.job.count({
    where: {
      title: {
        in: [...seededJobTitles],
      },
      createdBy: {
        email: {
          in: [...seededUserEmails],
        },
      },
    },
  });

const countSeedApplications = () =>
  prisma.application.count({
    where: {
      candidate: {
        email: {
          in: [...seededCandidateEmails],
        },
      },
      job: {
        title: {
          in: [...seededJobTitles],
        },
      },
    },
  });

describe('Prisma seed (e2e)', () => {
  jest.setTimeout(30000);

  beforeAll(async () => {
    assertSafeTestDatabase();
    await cleanupSeedData();
  });

  afterAll(async () => {
    await cleanupSeedData();
    await prisma.$disconnect();
  });

  it('should seed required core data with valid relationships', async () => {
    runSeed();

    const users = await prisma.user.findMany({
      where: { email: { in: [...seededUserEmails] } },
      orderBy: { email: 'asc' },
    });

    const candidates = await prisma.candidate.findMany({
      where: { email: { in: [...seededCandidateEmails] } },
      orderBy: { email: 'asc' },
    });

    const jobs = await prisma.job.findMany({
      where: {
        title: { in: [...seededJobTitles] },
        createdBy: {
          email: {
            in: [...seededUserEmails],
          },
        },
      },
      include: { createdBy: true },
      orderBy: { title: 'asc' },
    });

    const applications = await prisma.application.findMany({
      where: {
        candidate: {
          email: {
            in: [...seededCandidateEmails],
          },
        },
        job: {
          title: {
            in: [...seededJobTitles],
          },
        },
      },
      include: {
        candidate: true,
        job: true,
      },
    });

    expect(users).toHaveLength(seededUserEmails.length);
    expect(candidates).toHaveLength(seededCandidateEmails.length);
    expect(jobs).toHaveLength(seededJobTitles.length);
    expect(applications).toHaveLength(3);

    const userByEmail = new Map<string, User>(
      users.map((user) => [user.email, user]),
    );

    expect(userByEmail.get('seed-admin@talentflow.invalid')?.role).toBe(
      Role.ADMIN,
    );
    expect(userByEmail.get('seed-recruiter@talentflow.invalid')?.role).toBe(
      Role.RECRUITER,
    );
    expect(userByEmail.get('seed-interviewer@talentflow.invalid')?.role).toBe(
      Role.INTERVIEWER,
    );

    jobs.forEach((job: Job & { createdBy: User }) => {
      expect(
        seededUserEmails.includes(
          job.createdBy.email as (typeof seededUserEmails)[number],
        ),
      ).toBe(true);
    });

    applications.forEach(
      (application: Application & { candidate: Candidate; job: Job }) => {
        expect(
          seededCandidateEmails.includes(
            application.candidate
              .email as (typeof seededCandidateEmails)[number],
          ),
        ).toBe(true);
        expect(
          seededJobTitles.includes(
            application.job.title as (typeof seededJobTitles)[number],
          ),
        ).toBe(true);
      },
    );
  });

  it('should be idempotent when running seed multiple times', async () => {
    runSeed();

    const before = {
      users: await countSeedUsers(),
      candidates: await countSeedCandidates(),
      jobs: await countSeedJobs(),
      applications: await countSeedApplications(),
    };

    runSeed();

    const after = {
      users: await countSeedUsers(),
      candidates: await countSeedCandidates(),
      jobs: await countSeedJobs(),
      applications: await countSeedApplications(),
    };

    expect(after).toEqual(before);
  });
});
