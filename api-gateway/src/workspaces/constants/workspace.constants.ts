import { Prisma } from '@prisma/client';

export const WORKSPACE_SELECT = Prisma.validator<Prisma.WorkspaceSelect>()({
  id: true,
  name: true,
  isBusiness: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
});

export const USER_SUMMARY_SELECT = Prisma.validator<Prisma.UserSelect>()({
  id: true,
  email: true,
  fullName: true,
  role: true,
});

export const MEMBER_WITH_USER_SELECT =
  Prisma.validator<Prisma.WorkspaceMemberSelect>()({
    id: true,
    workspaceId: true,
    userId: true,
    role: true,
    status: true,
    invitedById: true,
    createdAt: true,
    updatedAt: true,
    user: {
      select: USER_SUMMARY_SELECT,
    },
  });
