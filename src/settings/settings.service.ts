import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { TournamentSettings } from '../entities';

/**
 * Claves válidas para `phaseDates`. Las eliminatorias se muestran u ocultan en
 * el front según cuántos equipos clasifiquen, pero aquí aceptamos todas y
 * descartamos cualquier clave desconocida que llegue en el body.
 */
/** Claves válidas de rango (PlayerRank) para min/maxRank — escalera completa. */
const RANK_KEYS = [
  'bronze1', 'bronze2', 'bronze3',
  'silver1', 'silver2', 'silver3',
  'gold1', 'gold2', 'gold3',
  'plat1', 'plat2', 'plat3',
  'dia1', 'dia2', 'dia3',
  'champ1', 'champ2', 'champ3',
  'gc1', 'gc2', 'gc3',
  'ssl',
];

const PHASE_KEYS = [
  'registrationOpen',
  'registrationClose',
  'groupDraw',
  'groupStage',
  'round32',
  'round16',
  'quarters',
  'semis',
  'third',
  'final',
] as const;

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

  /** Nombre del torneo/temporada. Cadena vacía o null lo limpia (cae a "Gravity"). */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  tournamentName?: string | null;

  /** Activa el modo de equipos predefinidos (selector de catálogo). */
  @IsOptional()
  @IsBoolean()
  predefinedTeamsMode?: boolean;

  /** Etiqueta de temporada/edición (ej. "Temporada 01"). */
  @IsOptional()
  @IsString()
  @MaxLength(60)
  seasonLabel?: string | null;

  /** Plataforma (ej. "Cross-play"). */
  @IsOptional()
  @IsString()
  @MaxLength(60)
  platform?: string | null;

  /** Lema/tagline de la landing. */
  @IsOptional()
  @IsString()
  @MaxLength(280)
  tagline?: string | null;

  /** Entrada gratis (true) o de pago (false). */
  @IsOptional()
  @IsBoolean()
  entryFree?: boolean;

  /** Rango mínimo/máximo elegible (clave de PlayerRank). */
  @IsOptional()
  @IsIn(RANK_KEYS)
  minRank?: string;

  @IsOptional()
  @IsIn(RANK_KEYS)
  maxRank?: string;

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

  /** Fechas de las fases (mapa fase → `YYYY-MM-DD`). Reemplaza el mapa entero. */
  @IsOptional()
  @IsObject()
  phaseDates?: Record<string, string> | null;

  // Premios por puesto (texto libre). Cadena vacía o null limpia el campo.
  @IsOptional()
  @IsString()
  @MaxLength(160)
  prizeFirst?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  prizeSecond?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  prizeThird?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  prizeNote?: string | null;
}

/** Recorta un texto y devuelve null si queda vacío (para limpiar columnas). */
function clean(v: string | null | undefined): string | null {
  const t = (v ?? '').trim();
  return t.length ? t : null;
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
    if (dto.tournamentName !== undefined) {
      settings.tournamentName = clean(dto.tournamentName);
    }
    if (typeof dto.predefinedTeamsMode === 'boolean') {
      settings.predefinedTeamsMode = dto.predefinedTeamsMode;
    }
    if (dto.seasonLabel !== undefined) settings.seasonLabel = clean(dto.seasonLabel);
    if (dto.platform !== undefined) settings.platform = clean(dto.platform);
    if (dto.tagline !== undefined) settings.tagline = clean(dto.tagline);
    if (typeof dto.entryFree === 'boolean') settings.entryFree = dto.entryFree;
    if (dto.minRank) settings.minRank = dto.minRank;
    if (dto.maxRank) settings.maxRank = dto.maxRank;
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
    if (dto.phaseDates !== undefined) {
      settings.phaseDates = this.sanitizePhaseDates(dto.phaseDates);
    }
    if (dto.prizeFirst !== undefined) settings.prizeFirst = clean(dto.prizeFirst);
    if (dto.prizeSecond !== undefined) settings.prizeSecond = clean(dto.prizeSecond);
    if (dto.prizeThird !== undefined) settings.prizeThird = clean(dto.prizeThird);
    if (dto.prizeNote !== undefined) settings.prizeNote = clean(dto.prizeNote);
    return this.repo.save(settings);
  }

  /**
   * Reemplaza el mapa de fechas: conserva solo las claves de fase conocidas con
   * un valor `YYYY-MM-DD` válido. Devuelve null si no queda ninguna.
   */
  private sanitizePhaseDates(
    input: Record<string, string> | null,
  ): Record<string, string> | null {
    if (!input || typeof input !== 'object') return null;
    const out: Record<string, string> = {};
    for (const key of PHASE_KEYS) {
      const raw = input[key];
      if (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) {
        out[key] = raw.trim();
      }
    }
    return Object.keys(out).length ? out : null;
  }
}
