import { Test, TestingModule } from '@nestjs/testing';
import { EmailTemplatesController } from './email-templates.controller';
import { EmailTemplatesService } from './email-templates.service';
import { EmailTemplateResponseDto } from './dto/email-template-response.dto';

describe('EmailTemplatesController', () => {
  let controller: EmailTemplatesController;
  let service: jest.Mocked<EmailTemplatesService>;

  beforeEach(async () => {
    const serviceMock = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [EmailTemplatesController],
      providers: [{ provide: EmailTemplatesService, useValue: serviceMock }],
    }).compile();

    controller = module.get<EmailTemplatesController>(EmailTemplatesController);
    service = module.get(EmailTemplatesService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should call service.create and return response DTO', async () => {
      const dto = { name: 'Welcome', subject: 'Subject', body: 'Body' };
      const template = {
        id: '1',
        ...dto,
        workspaceId: 'ws-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      service.create.mockResolvedValue(template);

      // Mock the static from method of EmailTemplateResponseDto
      jest.spyOn(EmailTemplateResponseDto, 'from').mockReturnValue(template);

      const result = await controller.create(dto);

      expect(service.create).toHaveBeenCalledWith(dto);
      expect(EmailTemplateResponseDto.from).toHaveBeenCalledWith(template);
      expect(result).toEqual(template);
    });
  });

  describe('findAll', () => {
    it('should call service.findAll', async () => {
      const query = { page: 1, limit: 10 };
      const response = {
        data: [],
        meta: { total: 0, page: 1, limit: 10, totalPages: 0 },
      };
      service.findAll.mockResolvedValue(response);

      const result = await controller.findAll(query);

      expect(service.findAll).toHaveBeenCalledWith(query);
      expect(result).toEqual(response);
    });
  });

  describe('findOne', () => {
    it('should call service.findOne and return response DTO', async () => {
      const id = '1';
      const template = {
        id,
        name: 'Welcome',
        workspaceId: 'ws-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      service.findOne.mockResolvedValue(template as any);

      jest
        .spyOn(EmailTemplateResponseDto, 'from')
        .mockReturnValue(template as any);

      const result = await controller.findOne(id);

      expect(service.findOne).toHaveBeenCalledWith(id);
      expect(EmailTemplateResponseDto.from).toHaveBeenCalledWith(template);
      expect(result).toEqual(template);
    });
  });

  describe('update', () => {
    it('should call service.update and return response DTO', async () => {
      const id = '1';
      const dto = { subject: 'Updated' };
      const template = {
        id,
        name: 'Welcome',
        subject: 'Updated',
        workspaceId: 'ws-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      service.update.mockResolvedValue(template as any);

      jest
        .spyOn(EmailTemplateResponseDto, 'from')
        .mockReturnValue(template as any);

      const result = await controller.update(id, dto);

      expect(service.update).toHaveBeenCalledWith(id, dto);
      expect(EmailTemplateResponseDto.from).toHaveBeenCalledWith(template);
      expect(result).toEqual(template);
    });
  });

  describe('remove', () => {
    it('should call service.remove', async () => {
      const id = '1';
      service.remove.mockResolvedValue(undefined);

      await controller.remove(id);

      expect(service.remove).toHaveBeenCalledWith(id);
    });
  });
});
