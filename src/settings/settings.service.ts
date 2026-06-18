import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import { TournamentSettings } from '../entities';

/**
 * DTO del PATCH /settings. Los decoradores de class-validator son
 * IMPRESCINDIBLES: con `ValidationPipe({ whitelist: true })` activo, toda
 * propiedad sin decorador se elimina del body y el update llegaría vacío.
 */
export class UpdateSettingsDto {
  @IsOptional()
  @IsBoolean()
  registrationsOpen?: boolean;

  @IsOptional()
  @IsBoolean()
  tournamentStarted?: boolean;

  /** Nº de equipos del torneo. Solo 16 o 32 (múltiplos de 4 con grupos válidos). */
  @IsOptional()
  @IsInt()
  @IsIn([16, 32])
  teamCapacity?: number;

  /** Jugadores por lado en cancha: 1 (1v1), 2 (2v2) o 3 (3v3). */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3)
  playersPerSide?: number;

  /** Suplentes por equipo (máx 2 para no exceder las 5 columnas de inscripción). */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2)
  substitutes?: number;

  /** Cierre de inscripciones (ISO) para el countdown. `null` lo limpia. */
  @IsOptional()
  @IsDateString()
  registrationDeadline?: string | null;

  // Formato de serie por fase eliminatoria (se aplica al regenerar la llave).
  @IsOptional()
  @IsIn(['bo3', 'bo5', 'bo7'])
  formatRound16?: string;

  @IsOptional()
  @IsIn(['bo3', 'bo5', 'bo7'])
  formatQuarters?: string;

  @IsOptional()
  @IsIn(['bo3', 'bo5', 'bo7'])
  formatSemis?: string;

  @IsOptional()
  @IsIn(['bo3', 'bo5', 'bo7'])
  formatThird?: string;

  @IsOptional()
  @IsIn(['bo3', 'bo5', 'bo7'])
  formatFinal?: string;
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
    if (typeof dto.playersPerSide === 'number' && dto.playersPerSide > 0) {
      settings.playersPerSide = Math.floor(dto.playersPerSide);
    }
    if (typeof dto.substitutes === 'number' && dto.substitutes >= 0) {
      settings.substitutes = Math.floor(dto.substitutes);
    }
    if (dto.registrationDeadline !== undefined) {
      settings.registrationDeadline = dto.registrationDeadline
        ? new Date(dto.registrationDeadline)
        : null;
    }
    if (dto.formatRound16) settings.formatRound16 = dto.formatRound16;
    if (dto.formatQuarters) settings.formatQuarters = dto.formatQuarters;
    if (dto.formatSemis) settings.formatSemis = dto.formatSemis;
    if (dto.formatThird) settings.formatThird = dto.formatThird;
    if (dto.formatFinal) settings.formatFinal = dto.formatFinal;
    return this.repo.save(settings);
  }
}
