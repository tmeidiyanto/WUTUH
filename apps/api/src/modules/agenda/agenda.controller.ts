import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { RequirePermissions } from '../../platform/auth/permissions.decorator';
import { AgendaService } from './agenda.service';
import { CreateAgendaDto, UpdateAgendaDto } from './dto/agenda.dto';

@Controller('agenda')
export class AgendaController {
  constructor(private readonly svc: AgendaService) {}

  @Get()
  @RequirePermissions('farm.read')
  list() {
    return this.svc.list();
  }

  @Post()
  @RequirePermissions('farm.write')
  create(@Body() dto: CreateAgendaDto) {
    return this.svc.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('farm.write')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAgendaDto) {
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('farm.write')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.remove(id);
  }

  @Post(':id/done')
  @RequirePermissions('farm.write')
  done(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.done(id);
  }
}
