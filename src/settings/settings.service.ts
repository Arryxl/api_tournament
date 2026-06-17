import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TournamentSettings } from '../entities';

export class UpdateSettingsDto {
  registrationsOpen?: boolean;
  tournamentStarted?: boolean;
  teamCapacity?: number;
}

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(TournamentSettings)
    private readonly repo: Repository<TournamentSettings>,
  ) {}

  /** Devuelve la fila única, creándola con valores por defecto si no existe. */
  async get(): Promise<TournamentSettings> {
    let settings = await this.repo.findOne({
      where: {},
      order: { updatedAt: 'DESC' },
    });
    if (!settings) {
      settings = await this.repo.save(this.repo.create({}));
    }
    return settings;
  }

  async update(dto: UpdateSettingsDto): Promise<TournamentSettings> {
    const settings = await this.get();
    if (typeof dto.registrationsOpen === 'boolean') {
      settings.registrationsOpen = dto.registrationsOpen;
    }
    if (typeof dto.tournamentStarted === 'boolean') {
      settings.tournamentStarted = dto.tournamentStarted;
    }
    if (typeof dto.teamCapacity === 'number' && dto.teamCapacity > 0) {
      settings.teamCapacity = Math.floor(dto.teamCapacity);
    }
    return this.repo.save(settings);
  }
}
