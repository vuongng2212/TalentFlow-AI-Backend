import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { EmailTemplatesService } from './email-templates.service';
import {
  CreateEmailTemplateDto,
  UpdateEmailTemplateDto,
} from './dto/create-email-template.dto';
import { QueryEmailTemplatesDto } from './dto/query-email-templates.dto';
import { EmailTemplateResponseDto } from './dto/email-template-response.dto';

@ApiTags('email-templates')
@ApiBearerAuth()
@ApiHeader({
  name: 'x-workspace-id',
  required: false,
  description: 'Active workspace ID for resource isolation',
})
@Controller('email-templates')
export class EmailTemplatesController {
  constructor(private readonly service: EmailTemplatesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateEmailTemplateDto) {
    const template = await this.service.create(dto);
    return EmailTemplateResponseDto.from(template);
  }

  @Get()
  async findAll(@Query() query: QueryEmailTemplatesDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  async findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    const template = await this.service.findOne(id);
    return EmailTemplateResponseDto.from(template);
  }

  @Patch(':id')
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateEmailTemplateDto,
  ) {
    const template = await this.service.update(id, dto);
    return EmailTemplateResponseDto.from(template);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', new ParseUUIDPipe()) id: string) {
    await this.service.remove(id);
  }
}
