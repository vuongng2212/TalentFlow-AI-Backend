import {
  ApplicationStage,
  ApplicationStatus,
  EmploymentType,
  InterviewStatus,
  InterviewType,
  JobStatus,
  PrismaClient,
  Role,
  WorkspaceMemberRole,
  WorkspaceMemberStatus,
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

async function main() {
  const defaultPassword = getSeedDefaultPassword();
  const hashedPassword = await bcrypt.hash(defaultPassword, SALT_ROUNDS);

  console.log('Clearing existing data...');
  await prisma.interview.deleteMany();
  await prisma.application.deleteMany();
  await prisma.candidate.deleteMany();
  await prisma.job.deleteMany();
  await prisma.emailTemplate.deleteMany();
  await prisma.workspaceInvitation.deleteMany();
  await prisma.workspaceMember.deleteMany();
  
  // Clear user activeWorkspaceId first to avoid foreign key violations when deleting workspaces
  await prisma.user.updateMany({
    data: { activeWorkspaceId: null },
  });
  await prisma.workspace.deleteMany();
  await prisma.user.deleteMany();

  console.log('Seeding Users and their Personal Workspaces...');
  // 1. Seed Core Users
  const userAdmin = await prisma.user.create({
    data: {
      email: 'seed-admin@talentflow.invalid',
      fullName: 'Seed System Admin',
      role: Role.ADMIN,
      password: hashedPassword,
    },
  });

  const userRecruiter = await prisma.user.create({
    data: {
      email: 'seed-recruiter@talentflow.invalid',
      fullName: 'Seed Lead Recruiter',
      role: Role.RECRUITER,
      password: hashedPassword,
    },
  });

  const userInterviewer = await prisma.user.create({
    data: {
      email: 'seed-interviewer@talentflow.invalid',
      fullName: 'Seed Technical Interviewer',
      role: Role.INTERVIEWER,
      password: hashedPassword,
    },
  });

  // Invited Recruiter (user account created but in INVITED membership status)
  const userInvitedRecruiter = await prisma.user.create({
    data: {
      email: 'invited-recruiter@talentflow.invalid',
      fullName: 'Invited Recruiter',
      role: Role.RECRUITER,
      password: hashedPassword,
    },
  });

  // Provision Personal Workspaces
  const users = [userAdmin, userRecruiter, userInterviewer, userInvitedRecruiter];
  for (const user of users) {
    const personalWorkspace = await prisma.workspace.create({
      data: {
        name: `${user.fullName} - Personal Workspace`,
        isBusiness: false,
        createdById: user.id,
      },
    });

    await prisma.workspaceMember.create({
      data: {
        workspaceId: personalWorkspace.id,
        userId: user.id,
        role: WorkspaceMemberRole.OWNER,
        status: WorkspaceMemberStatus.ACTIVE,
        invitedById: user.id,
      },
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { activeWorkspaceId: personalWorkspace.id },
    });
  }

  console.log('Seeding Business Workspace...');
  // 2. Seed Business Workspace (Tenant)
  const businessWorkspace = await prisma.workspace.create({
    data: {
      name: 'Acme Corp - Tech Recruitment',
      isBusiness: true,
      createdById: userAdmin.id,
    },
  });

  // 3. Seed Workspace Memberships for Business Workspace
  // Owner: Admin
  await prisma.workspaceMember.create({
    data: {
      workspaceId: businessWorkspace.id,
      userId: userAdmin.id,
      role: WorkspaceMemberRole.OWNER,
      status: WorkspaceMemberStatus.ACTIVE,
      invitedById: userAdmin.id,
    },
  });

  // Admin Member: Recruiter
  await prisma.workspaceMember.create({
    data: {
      workspaceId: businessWorkspace.id,
      userId: userRecruiter.id,
      role: WorkspaceMemberRole.ADMIN,
      status: WorkspaceMemberStatus.ACTIVE,
      invitedById: userAdmin.id,
    },
  });

  // Recruiter Member: Interviewer
  await prisma.workspaceMember.create({
    data: {
      workspaceId: businessWorkspace.id,
      userId: userInterviewer.id,
      role: WorkspaceMemberRole.RECRUITER,
      status: WorkspaceMemberStatus.ACTIVE,
      invitedById: userAdmin.id,
    },
  });

  // Invited Member: Invited Recruiter
  await prisma.workspaceMember.create({
    data: {
      workspaceId: businessWorkspace.id,
      userId: userInvitedRecruiter.id,
      role: WorkspaceMemberRole.RECRUITER,
      status: WorkspaceMemberStatus.INVITED,
      invitedById: userAdmin.id,
    },
  });

  // Set active workspaces to Business Workspace for active test users
  await prisma.user.update({
    where: { id: userAdmin.id },
    data: { activeWorkspaceId: businessWorkspace.id },
  });

  await prisma.user.update({
    where: { id: userRecruiter.id },
    data: { activeWorkspaceId: businessWorkspace.id },
  });

  await prisma.user.update({
    where: { id: userInterviewer.id },
    data: { activeWorkspaceId: businessWorkspace.id },
  });

  console.log('Seeding Workspace Invitation...');
  // 4. Seed Workspace Invitation
  await prisma.workspaceInvitation.create({
    data: {
      email: 'invited-recruiter@talentflow.invalid',
      workspaceId: businessWorkspace.id,
      token: 'invite-token-uuid-12345-acme',
      role: WorkspaceMemberRole.RECRUITER,
      invitedById: userAdmin.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    },
  });

  console.log('Seeding Email Templates...');
  // 5. Seed Email Templates
  await prisma.emailTemplate.create({
    data: {
      name: 'interview-invitation',
      subject: 'Interview invitation for {{candidateName}}',
      body: 'Hi {{candidateName}},\n\nWe would like to invite you for an interview for the position of {{jobTitle}}.\n\nBest regards,\n{{companyName}}',
      workspaceId: businessWorkspace.id,
    },
  });

  await prisma.emailTemplate.create({
    data: {
      name: 'rejection-email',
      subject: 'Application Update - TalentFlow',
      body: 'Dear {{candidateName}},\n\nThank you for your interest in the {{jobTitle}} position at Acme Corp. Unfortunately, we decided to move forward with other candidates.\n\nBest regards,\n{{companyName}}',
      workspaceId: businessWorkspace.id,
    },
  });

  console.log('Seeding Jobs...');
  // 6. Seed Jobs inside the Business Workspace
  const jobBackend = await prisma.job.create({
    data: {
      title: 'Senior Backend Engineer',
      description: 'Build scalable backend services for ATS workflows and hiring automation.',
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
      workspaceId: businessWorkspace.id,
      createdById: userRecruiter.id,
    },
  });

  const jobFrontend = await prisma.job.create({
    data: {
      title: 'Frontend Engineer',
      description: 'Develop modern, responsive interfaces for recruiters and hiring managers.',
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
      workspaceId: businessWorkspace.id,
      createdById: userRecruiter.id,
    },
  });

  const jobDevOps = await prisma.job.create({
    data: {
      title: 'DevOps Engineer',
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
      status: JobStatus.OPEN,
      workspaceId: businessWorkspace.id,
      createdById: userAdmin.id,
    },
  });

  const jobProductManager = await prisma.job.create({
    data: {
      title: 'Product Manager',
      description: 'Define product vision and collaborate with engineering team.',
      requirements: [
        'Product management experience in B2B SaaS',
        'Strong roadmap execution and analytical skills',
      ],
      department: 'Product',
      location: 'Ho Chi Minh City',
      employmentType: EmploymentType.FULL_TIME,
      salaryMin: 3000,
      salaryMax: 5000,
      status: JobStatus.DRAFT,
      workspaceId: businessWorkspace.id,
      createdById: userRecruiter.id,
    },
  });

  console.log('Seeding Candidates...');
  // 7. Seed Candidates inside the Business Workspace
  const candidateAlice = await prisma.candidate.create({
    data: {
      email: 'seed-alice.candidate@talentflow.invalid',
      fullName: 'Seed Alice Nguyen',
      phone: '+84901111222',
      linkedinUrl: 'https://linkedin.com/in/seed-alice-nguyen',
      resumeUrl: 'https://minio.local/talentflow-cvs/seed-alice-nguyen.pdf',
      resumeText: 'Seed backend engineer with 4 years experience in Node.js and PostgreSQL.',
      workspaceId: businessWorkspace.id,
    },
  });

  const candidateBob = await prisma.candidate.create({
    data: {
      email: 'seed-bob.candidate@talentflow.invalid',
      fullName: 'Seed Bob Tran',
      phone: '+84903333444',
      linkedinUrl: 'https://linkedin.com/in/seed-bob-tran',
      resumeUrl: 'https://minio.local/talentflow-cvs/seed-bob-tran.pdf',
      resumeText: 'Seed frontend engineer focused on React, TypeScript, and accessibility.',
      workspaceId: businessWorkspace.id,
    },
  });

  const candidateCharlie = await prisma.candidate.create({
    data: {
      email: 'seed-charlie.candidate@talentflow.invalid',
      fullName: 'Seed Charlie Le',
      phone: '+84905555666',
      linkedinUrl: 'https://linkedin.com/in/seed-charlie-le',
      resumeUrl: 'https://minio.local/talentflow-cvs/seed-charlie-le.pdf',
      resumeText: 'Seed DevOps engineer experienced with Docker, CI/CD, and cloud infrastructure.',
      workspaceId: businessWorkspace.id,
    },
  });

  const candidateDavid = await prisma.candidate.create({
    data: {
      email: 'seed-david.candidate@talentflow.invalid',
      fullName: 'Seed David Pham',
      phone: '+84907777888',
      linkedinUrl: 'https://linkedin.com/in/seed-david-pham',
      resumeUrl: 'https://minio.local/talentflow-cvs/seed-david-pham.pdf',
      resumeText: 'Experienced PM with strong track record in SaaS.',
      workspaceId: businessWorkspace.id,
    },
  });

  console.log('Seeding Applications...');
  // 8. Seed Applications inside the Business Workspace
  const appAlice = await prisma.application.create({
    data: {
      jobId: jobBackend.id,
      candidateId: candidateAlice.id,
      workspaceId: businessWorkspace.id,
      stage: ApplicationStage.SCREENING,
      status: ApplicationStatus.REVIEWING,
      notes: 'Strong backend fundamentals and good communication.',
      appliedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    },
  });

  const appBob = await prisma.application.create({
    data: {
      jobId: jobFrontend.id,
      candidateId: candidateBob.id,
      workspaceId: businessWorkspace.id,
      stage: ApplicationStage.INTERVIEW,
      status: ApplicationStatus.INTERVIEW_SCHEDULED,
      notes: 'Portfolio quality is strong. Proceed to technical interview.',
      appliedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    },
  });

  const appCharlie = await prisma.application.create({
    data: {
      jobId: jobDevOps.id,
      candidateId: candidateCharlie.id,
      workspaceId: businessWorkspace.id,
      stage: ApplicationStage.OFFER,
      status: ApplicationStatus.ACCEPTED,
      notes: 'Initial application submitted and awaiting review.',
      appliedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    },
  });

  const appDavid = await prisma.application.create({
    data: {
      jobId: jobBackend.id,
      candidateId: candidateDavid.id,
      workspaceId: businessWorkspace.id,
      stage: ApplicationStage.REJECTED,
      status: ApplicationStatus.REJECTED,
      notes: 'Lacks required backend experience.',
      appliedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
    },
  });

  console.log('Seeding Interviews...');
  // 9. Seed Interviews inside the Business Workspace
  await prisma.interview.create({
    data: {
      applicationId: appBob.id,
      workspaceId: businessWorkspace.id,
      scheduledAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
      duration: 60,
      type: InterviewType.VIDEO,
      location: 'https://meet.google.com/seed-bob-interview',
      notes: 'Technical interview: React, TypeScript, state management',
      status: InterviewStatus.SCHEDULED,
      interviewerId: userInterviewer.id,
    },
  });

  await prisma.interview.create({
    data: {
      applicationId: appAlice.id,
      workspaceId: businessWorkspace.id,
      scheduledAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
      duration: 45,
      type: InterviewType.PHONE,
      location: '+84901111222',
      notes: 'Phone screening: discuss experience and expectations',
      status: InterviewStatus.SCHEDULED,
      interviewerId: userRecruiter.id,
    },
  });

  await prisma.interview.create({
    data: {
      applicationId: appAlice.id,
      workspaceId: businessWorkspace.id,
      scheduledAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
      duration: 90,
      type: InterviewType.VIDEO,
      location: 'https://zoom.us/j/seed-alice-technical',
      notes: 'Completed system design round. Candidate performed well.',
      status: InterviewStatus.COMPLETED,
      interviewerId: userInterviewer.id,
    },
  });

  console.log('Seed completed successfully!');
  console.log(`- Workspaces: ${await prisma.workspace.count()}`);
  console.log(`- Workspace Member: ${await prisma.workspaceMember.count()}`);
  console.log(`- Workspace Invitation: ${await prisma.workspaceInvitation.count()}`);
  console.log(`- Email Templates: ${await prisma.emailTemplate.count()}`);
  console.log(`- Jobs: ${await prisma.job.count()}`);
  console.log(`- Candidates: ${await prisma.candidate.count()}`);
  console.log(`- Applications: ${await prisma.application.count()}`);
  console.log(`- Interviews: ${await prisma.interview.count()}`);
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
