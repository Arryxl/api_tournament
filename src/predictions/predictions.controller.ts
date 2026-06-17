import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { PredictionsService } from './predictions.service';
import { CurrentUser, Public, Roles } from '../common/decorators';
import { UserRole } from '../common/enums';

@Controller('predictions')
export class PredictionsController {
  constructor(private readonly predictions: PredictionsService) {}

  @Get('match/:matchId')
  forMatch(@Param('matchId') matchId: string) {
    return this.predictions.forMatch(matchId);
  }

  @Post()
  create(@CurrentUser('userId') userId: string, @Body() body: any) {
    return this.predictions.create(userId, body);
  }

  @Get('my')
  mine(@CurrentUser('userId') userId: string) {
    return this.predictions.myPredictions(userId);
  }

  @Public()
  @Get('leaderboard')
  leaderboard() {
    return this.predictions.leaderboard();
  }

  @Roles(UserRole.ADMIN)
  @Post('windows')
  createWindow(@CurrentUser('userId') adminId: string, @Body() body: any) {
    return this.predictions.createWindow(adminId, body);
  }

  @Roles(UserRole.ADMIN)
  @Patch('windows/:id')
  toggleWindow(@Param('id') id: string, @Body() body: { isActive: boolean }) {
    return this.predictions.toggleWindow(id, body.isActive);
  }

  @Roles(UserRole.ADMIN)
  @Patch('match/:matchId/close')
  closeForMatch(@Param('matchId') matchId: string) {
    return this.predictions.closeForMatch(matchId);
  }
}
