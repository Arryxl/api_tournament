import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LinkedAccount, TeamMember } from '../entities';
import { LinkingService } from './linking.service';
import { LinkingController } from './linking.controller';
import { SteamProvider } from './steam.provider';
import { EpicProvider } from './epic.provider';

@Module({
  imports: [
    TypeOrmModule.forFeature([LinkedAccount, TeamMember]),
    JwtModule.register({}),
  ],
  controllers: [LinkingController],
  providers: [LinkingService, SteamProvider, EpicProvider],
  exports: [LinkingService],
})
export class LinkingModule {}
