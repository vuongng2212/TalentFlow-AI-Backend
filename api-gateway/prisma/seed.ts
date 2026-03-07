import {
  ApplicationStage,
  ApplicationStatus,
  EmploymentType,
  JobStatus,
  PrismaClient,
  Role,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const SALT_ROUNDS = 10;

if (process.env.NODE_ENV === 'production') {
  throw new Error('Refusing to run seed in production environment');
}

const getSeedDefaultPassword = (): string => {
  const seedPassword = process.env.SEED_DEFAULT_PASSWORD;

  if (!seedPassword) {
    throw new Error('Missing required env: SEED_DEFAULT_PASSWORD');
  }

  return seedPassword;
};

const seedUsers = [
  {
    email: 'seed-admin@talentflow.invalid',
    fullName: 'Seed System Admin',
    role: Role.ADMIN,
  },
  {
    email: 'seed-recruiter@talentflow.invalid',
    fullName: 'Seed Lead Recruiter',
    role: Role.RECRUITER,
  },
  {
    email: 'seed-interviewer@talentflow.invalid',
    fullName: 'Seed Technical Interviewer',
    role: Role.INTERVIEWER,
  },
] as const;
const seedCandidates = [
  {
    email: 'seed-alice.candidate@talentflow.invalid',
    fullName: 'Seed Alice Nguyen',
    phone: '+84901111222',
    linkedinUrl: 'https://linkedin.com/in/seed-alice-nguyen',
    resumeUrl: 'https://minio.local/talentflow-cvs/seed-alice-nguyen.pdf',
    resumeText: 'Seed backend engineer with 4 years experience in Node.js and PostgreSQL.',
  },
  {
    email: 'seed-bob.candidate@talentflow.invalid',
    fullName: 'Seed Bob Tran',
    phone: '+84903333444',
    linkedinUrl: 'https://linkedin.com/in/seed-bob-tran',
    resumeUrl: 'https://minio.local/talentflow-cvs/seed-bob-tran.pdf',
    resumeText: 'Seed frontend engineer focused on React, TypeScript, and accessibility.',
  },
  {
    email: 'seed-charlie.candidate@talentflow.invalid',
    fullName: 'Seed Charlie Le',
    phone: '+84905555666',
    linkedinUrl: 'https://linkedin.com/in/seed-charlie-le',
    resumeUrl: 'https://minio.local/talentflow-cvs/seed-charlie-le.pdf',
    resumeText: 'Seed DevOps engineer experienced with Docker, CI/CD, and cloud infrastructure.',
  },
] as const;

const seedJobs = [
  {
    title: '__seed__senior_backend_engineer',
    description:
      'Build scalable backend services for ATS workflows and hiring automation.',
    requirements: [
      '3+ years experience with Node.js or NestJS',
      'Strong SQL and data modeling skills',
      'Experience with message queues and distributed systems',
    ],
    department: 'Engineering',
    location: 'Ho Chi Minh City',
    employmentType: EmploymentType.FULL_TIME,
    salaryMin: 2500,
    salaryMax: 4000,
    status: JobStatus.OPEN,
    createdByEmail: 'seed-recruiter@talentflow.invalid',
  },
  {
    title: '__seed__frontend_engineer',
    description:
      'Develop modern, responsive interfaces for recruiters and hiring managers.',
    requirements: [
      'Strong React and TypeScript knowledge',
      'Experience with state management and testing',
      'Understanding of REST APIs and UX principles',
    ],
    department: 'Engineering',
    location: 'Da Nang',
    employmentType: EmploymentType.FULL_TIME,
    salaryMin: 1800,
    salaryMax: 3000,
    status: JobStatus.OPEN,
    createdByEmail: 'seed-recruiter@talentflow.invalid',
  },
  {
    title: '__seed__devops_engineer',
    description: 'Maintain infrastructure, observability, and deployment pipelines.',
    requirements: [
      'Hands-on with Docker and Kubernetes',
      'Experience with CI/CD and IaC',
      'Strong Linux and networking fundamentals',
    ],
    department: 'Platform',
    location: 'Remote',
    employmentType: EmploymentType.CONTRACT,
    salaryMin: 2200,
    salaryMax: 3500,
    status: JobStatus.DRAFT,
    createdByEmail: 'seed-admin@talentflow.invalid',
  },
] as const;

const seedApplications = [
  {
    jobTitle: '__seed__senior_backend_engineer',
    candidateEmail: 'seed-alice.candidate@talentflow.invalid',
    stage: ApplicationStage.SCREENING,
    status: ApplicationStatus.REVIEWING,
    notes: 'Strong backend fundamentals and good communication.',
  },
  {
    jobTitle: '__seed__frontend_engineer',
    candidateEmail: 'seed-bob.candidate@talentflow.invalid',
    stage: ApplicationStage.INTERVIEW,
    status: ApplicationStatus.INTERVIEW_SCHEDULED,
    notes: 'Portfolio quality is strong. Proceed to technical interview.',
  },
  {
    jobTitle: '__seed__devops_engineer',
    candidateEmail: 'seed-charlie.candidate@talentflow.invalid',
    stage: ApplicationStage.APPLIED,
    status: ApplicationStatus.SUBMITTED,
    notes: 'Initial application submitted and awaiting review.',
  },
] as const;

const upsertJobByTitleAndCreator = async (input: {
  title: string;
  description: string;
  requirements: readonly string[];
  department: string;
  location: string;
  employmentType: EmploymentType;
  salaryMin: number;
  salaryMax: number;
  status: JobStatus;
  createdById: string;
}) => {
  const existing = await prisma.job.findFirst({
    where: {
      title: input.title,
      createdById: input.createdById,
      deletedAt: null,
    },
  });

  if (existing) {
    return prisma.job.update({
      where: { id: existing.id },
      data: {
        description: input.description,
        requirements: input.requirements,
        department: input.department,
        location: input.location,
        employmentType: input.employmentType,
        salaryMin: input.salaryMin,
        salaryMax: input.salaryMax,
        status: input.status,
        deletedAt: null,
      },
    });
  }

  return prisma.job.create({
    data: {
      title: input.title,
      description: input.description,
      requirements: input.requirements,
      department: input.department,
      location: input.location,
      employmentType: input.employmentType,
      salaryMin: input.salaryMin,
      salaryMax: input.salaryMax,
      status: input.status,
      createdById: input.createdById,
    },
  });
};

async function main() {
  const hashedPassword = await bcrypt.hash(getSeedDefaultPassword(), SALT_ROUNDS);

  const users = await Promise.all(
    seedUsers.map((user) =>
      prisma.user.upsert({
        where: { email: user.email },
        update: {
          fullName: user.fullName,
          role: user.role,
          password: hashedPassword,
          deletedAt: null,
        },
        create: {
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          password: hashedPassword,
        },
      }),
    ),
  );

  const userByEmail = new Map(users.map((user) => [user.email, user]));

  const candidates = await Promise.all(
    seedCandidates.map((candidate) =>
      prisma.candidate.upsert({
        where: { email: candidate.email },
        update: {
          fullName: candidate.fullName,
          phone: candidate.phone,
          linkedinUrl: candidate.linkedinUrl,
          resumeUrl: candidate.resumeUrl,
          resumeText: candidate.resumeText,
        },
        create: {
          email: candidate.email,
          fullName: candidate.fullName,
          phone: candidate.phone,
          linkedinUrl: candidate.linkedinUrl,
          resumeUrl: candidate.resumeUrl,
          resumeText: candidate.resumeText,
        },
      }),
    ),
  );

  const candidateByEmail = new Map(
    candidates.map((candidate) => [candidate.email, candidate]),
  );

  const jobs = await Promise.all(
    seedJobs.map(async (job) => {
      const creator = userByEmail.get(job.createdByEmail);

      if (!creator) {
        throw new Error(`Missing seeded creator: ${job.createdByEmail}`);
      }

      return upsertJobByTitleAndCreator({
        title: job.title,
        description: job.description,
        requirements: job.requirements,
        department: job.department,
        location: job.location,
        employmentType: job.employmentType,
        salaryMin: job.salaryMin,
        salaryMax: job.salaryMax,
        status: job.status,
        createdById: creator.id,
      });
    }),
  );

  const jobByTitle = new Map(jobs.map((job) => [job.title, job]));

  await Promise.all(
    seedApplications.map(async (application) => {
      const job = jobByTitle.get(application.jobTitle);
      const candidate = candidateByEmail.get(application.candidateEmail);

      if (!job) {
        throw new Error(`Missing seeded job: ${application.jobTitle}`);
      }

      if (!candidate) {
        throw new Error(`Missing seeded candidate: ${application.candidateEmail}`);
      }

      await prisma.application.upsert({
        where: {
          jobId_candidateId: {
            jobId: job.id,
            candidateId: candidate.id,
          },
        },
        update: {
          stage: application.stage,
          status: application.status,
          notes: application.notes,
          deletedAt: null,
        },
        create: {
          jobId: job.id,
          candidateId: candidate.id,
          stage: application.stage,
          status: application.status,
          notes: application.notes,
        },
      });
    }),
  );

  console.log('Seed completed successfully');
  console.log(`Users: ${users.length}`);
  console.log(`Candidates: ${candidates.length}`);
  console.log(`Jobs: ${jobs.length}`);
  console.log(`Applications: ${seedApplications.length}`);
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
