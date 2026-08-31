import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { RequirePermissions } from '../../platform/auth/permissions.decorator';
import { IamService } from './iam.service';
import { CreateUserDto, UpdateUserDto } from './dto/iam.dto';

@Controller('iam')
export class IamController {
  constructor(private readonly svc: IamService) {}

  @Get('roles')
  @RequirePermissions('iam.read')
  listRoles() {
    return this.svc.listRoles();
  }

  @Get('users')
  @RequirePermissions('iam.read')
  listUsers() {
    return this.svc.listUsers();
  }

  @Post('users')
  @RequirePermissions('iam.write')
  createUser(@Body() dto: CreateUserDto) {
    return this.svc.createUser(dto);
  }

  @Patch('users/:id')
  @RequirePermissions('iam.write')
  updateUser(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserDto) {
    return this.svc.updateUser(id, dto);
  }
}
