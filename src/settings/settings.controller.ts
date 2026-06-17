import { Body, Controller, Get, Patch } from '@nestjs/common';
import { SettingsService, UpdateSettingsDto } from './settings.service';
import { Public, Roles } from '../common/decorators';
import { UserRole } from '../common/enums';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Public()
  @Get()
  get() {
    return this.settings.get();
  }

  @Roles(UserRole.ADMIN)
  @Patch()
  update(@Body() dto: UpdateSettingsDto) {
    return this.settings.update(dto);
  }
}
