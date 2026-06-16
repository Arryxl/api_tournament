import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { IsEmail, IsInt, IsOptional, IsString, MinLength } from 'class-validator';
import { UsersService } from './users.service';
import { Roles } from '../common/decorators';
import { UserRole } from '../common/enums';

class CreateCandidateDto {
  @IsString()
  @MinLength(3)
  username: string;

  @IsString()
  @MinLength(4)
  password: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}

class UpdateUserDto {
  @IsOptional() @IsString() username?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() password?: string;
  @IsOptional() isActive?: boolean;
}

class CoinsDto {
  @IsInt()
  amount: number;

  @IsString()
  concept: string;
}

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Roles(UserRole.ADMIN)
  @Get()
  findAll() {
    return this.users.findAll();
  }

  @Roles(UserRole.ADMIN)
  @Post('candidate')
  createCandidate(@Body() dto: CreateCandidateDto) {
    return this.users.createCandidate(dto);
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.users.update(id, dto as any);
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id/coins')
  adjustCoins(@Param('id') id: string, @Body() dto: CoinsDto) {
    return this.users.adjustCoins(id, dto.amount, dto.concept);
  }

  @Roles(UserRole.ADMIN)
  @Delete(':id')
  deactivate(@Param('id') id: string) {
    return this.users.deactivate(id);
  }

  @Roles(UserRole.ADMIN, UserRole.CANDIDATE)
  @Get(':id/stats')
  stats(@Param('id') id: string) {
    return this.users.getStats(id);
  }
}
