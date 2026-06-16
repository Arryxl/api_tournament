import { Body, Controller, Get, Post } from '@nestjs/common';
import { CoinsService } from './coins.service';
import { CurrentUser, Public, Roles } from '../common/decorators';
import { UserRole } from '../common/enums';

@Controller('coins')
export class CoinsController {
  constructor(private readonly coins: CoinsService) {}

  @Get('balance')
  balance(@CurrentUser('userId') userId: string) {
    return this.coins.balance(userId);
  }

  @Get('history')
  history(@CurrentUser('userId') userId: string) {
    return this.coins.history(userId);
  }

  @Public()
  @Get('leaderboard')
  leaderboard() {
    return this.coins.leaderboard();
  }

  @Roles(UserRole.ADMIN)
  @Post('grant')
  grant(@Body() body: { userId: string; amount: number; concept: string }) {
    return this.coins.grant(body.userId, body.amount, body.concept);
  }
}
