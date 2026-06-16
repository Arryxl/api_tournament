import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { RewardsService } from './rewards.service';
import { CurrentUser, Public, Roles } from '../common/decorators';
import { RedemptionStatus, UserRole } from '../common/enums';

@Controller('rewards')
export class RewardsController {
  constructor(private readonly rewards: RewardsService) {}

  @Public()
  @Get()
  findAll() {
    return this.rewards.findAll();
  }

  @Roles(UserRole.ADMIN)
  @Post()
  create(@Body() body: any) {
    return this.rewards.create(body);
  }

  @Roles(UserRole.ADMIN)
  @Get('redemptions')
  redemptions() {
    return this.rewards.listRedemptions();
  }

  @Roles(UserRole.ADMIN)
  @Patch('redemptions/:id')
  updateRedemption(
    @Param('id') id: string,
    @Body() body: { status: RedemptionStatus; notes?: string },
  ) {
    return this.rewards.updateRedemption(id, body.status, body.notes);
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.rewards.update(id, body);
  }

  @Roles(UserRole.ADMIN)
  @Delete(':id')
  deactivate(@Param('id') id: string) {
    return this.rewards.deactivate(id);
  }

  @Post(':id/redeem')
  redeem(@Param('id') id: string, @CurrentUser('userId') userId: string) {
    return this.rewards.redeem(userId, id);
  }
}
