import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  Role,
  WorkspaceMemberRole,
  WorkspaceMemberStatus,
} from '@prisma/client';
import { QueryUsersDto } from './dto/query-users.dto';
import type { PaginatedResult } from '../common/dto/pagination.dto';
import type { User } from '@prisma/client';

type SafeUser = Omit<User, 'password'>;

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Atomically provisions a default Personal Workspace and active
   * OWNER membership for a freshly created user, then sets
   * `activeWorkspaceId`. This is wrapped in a single transaction
   * so partial failures do not leave orphan users or workspace-less
   * accounts.
   */
  async createWithPersonalWorkspace(
    email: string,
    password: string,
    fullName: string,
    role: Role,
  ): Promise<{ user: User; personalWorkspaceId: string }> {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          password,
          fullName,
          role,
        },
      });

      const personalWorkspace = await tx.workspace.create({
        data: {
          name: `${fullName} - Personal Workspace`,
          isBusiness: false,
          createdById: user.id,
        },
      });

      await tx.workspaceMember.create({
        data: {
          workspaceId: personalWorkspace.id,
          userId: user.id,
          role: WorkspaceMemberRole.OWNER,
          status: WorkspaceMemberStatus.ACTIVE,
          invitedById: user.id,
        },
      });

      const updatedUser = await tx.user.update({
        where: { id: user.id },
        data: { activeWorkspaceId: personalWorkspace.id },
      });

      this.logger.log(
        `Provisioned personal workspace ${personalWorkspace.id} for new user ${user.id}`,
      );

      return { user: updatedUser, personalWorkspaceId: personalWorkspace.id };
    });
  }

  async create(email: string, password: string, fullName: string, role: Role) {
    return this.prisma.user.create({
      data: {
        email,
        password,
        fullName,
        role,
      },
    });
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  /**
   * Switches the user's active workspace. Throws ForbiddenException
   * if the user is not an active member of the target workspace.
   */
  async switchActiveWorkspace(
    userId: string,
    workspaceId: string,
  ): Promise<SafeUser> {
    const membership = await this.prisma.workspaceMember.findFirst({
      where: {
        workspaceId,
        userId,
        status: WorkspaceMemberStatus.ACTIVE,
      },
      select: { id: true },
    });

    if (!membership) {
      throw new ForbiddenException(
        'You are not an active member of the target workspace',
      );
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { activeWorkspaceId: workspaceId },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        activeWorkspaceId: true,
        createdAt: true,
        updatedAt: true,
        deletedAt: true,
      },
    });

    this.logger.log(
      `User ${userId} switched active workspace to ${workspaceId}`,
    );

    return updated as SafeUser;
  }

  async findAll(query: QueryUsersDto): Promise<PaginatedResult<SafeUser>> {
    const {
      page = 1,
      limit = 10,
      search,
      role,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      deletedAt: null,
    };

    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (role) {
      where.role = role;
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
          createdAt: true,
          updatedAt: true,
          deletedAt: true,
        },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users as SafeUser[],
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOneProfile(id: string): Promise<SafeUser> {
    const user = await this.prisma.user.findUnique({
      where: { id, deletedAt: null },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        deletedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }

    return user as SafeUser;
  }

  async update(id: string, data: Partial<{ fullName: string; role: Role }>) {
    return this.prisma.user.update({
      where: { id },
      data,
    });
  }

  async updateProfile(
    targetId: string,
    requesterId: string,
    requesterRole: string,
    data: { fullName?: string },
  ): Promise<SafeUser> {
    // Users can update their own profile, admins can update anyone
    if (targetId !== requesterId && requesterRole !== 'ADMIN') {
      throw new ForbiddenException('You can only update your own profile');
    }

    const existing = await this.prisma.user.findUnique({
      where: { id: targetId, deletedAt: null },
    });

    if (!existing) {
      throw new NotFoundException(`User with ID "${targetId}" not found`);
    }

    this.logger.log(`User ${requesterId} updating profile of ${targetId}`);

    const updated = await this.prisma.user.update({
      where: { id: targetId },
      data: {
        ...(data.fullName !== undefined && { fullName: data.fullName }),
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        deletedAt: true,
      },
    });

    return updated as SafeUser;
  }

  async updateRole(targetId: string, newRole: Role): Promise<SafeUser> {
    const existing = await this.prisma.user.findUnique({
      where: { id: targetId, deletedAt: null },
    });

    if (!existing) {
      throw new NotFoundException(`User with ID "${targetId}" not found`);
    }

    this.logger.log(`Changing role of user ${targetId} to ${newRole}`);

    const updated = await this.prisma.user.update({
      where: { id: targetId },
      data: { role: newRole },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        deletedAt: true,
      },
    });

    return updated as SafeUser;
  }

  async softDelete(id: string) {
    return this.prisma.user.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });
  }

  async softDeleteUser(targetId: string): Promise<void> {
    const existing = await this.prisma.user.findUnique({
      where: { id: targetId, deletedAt: null },
    });

    if (!existing) {
      throw new NotFoundException(`User with ID "${targetId}" not found`);
    }

    this.logger.log(`Soft-deleting user ${targetId}`);

    await this.prisma.user.update({
      where: { id: targetId },
      data: { deletedAt: new Date() },
    });
  }
}
