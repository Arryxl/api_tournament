import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Configuración global del torneo (fila única).
 * Controla el estado que se propaga por todo el sistema:
 *  - registrationsOpen: las inscripciones siguen abiertas.
 *  - tournamentStarted: el torneo ya arrancó (fase de grupos en marcha).
 */
@Entity('tournament_settings')
export class TournamentSettings {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'registrations_open', type: 'boolean', default: true })
  registrationsOpen: boolean;

  @Column({ name: 'tournament_started', type: 'boolean', default: false })
  tournamentStarted: boolean;

  /**
   * Nombre del torneo/temporada (ej. "Gravity League S01"). Es distinto de la
   * marca fija "Gravity": se muestra en título del navegador, landing, overlays
   * y el escenario del sorteo. Si es null el front cae a "Gravity".
   */
  @Column({ name: 'tournament_name', type: 'varchar', length: 120, nullable: true })
  tournamentName: string | null;

  /**
   * Modo "equipos predefinidos": cuando está activo, la inscripción y el
   * reclutamiento dejan de pedir nombre+escudo libres y el capitán elige uno de
   * los equipos del catálogo (preset-teams.ts). También habilita el apartado de
   * "equipos disponibles" en la landing. OFF = comportamiento clásico.
   */
  @Column({ name: 'predefined_teams_mode', type: 'boolean', default: false })
  predefinedTeamsMode: boolean;

  /** Etiqueta de temporada/edición (ej. "Temporada 01"). Null → "Temporada 01". */
  @Column({ name: 'season_label', type: 'varchar', length: 60, nullable: true })
  seasonLabel: string | null;

  /** Plataforma (ej. "Cross-play"). Null → "Cross-play". Promo de la landing. */
  @Column({ name: 'platform', type: 'varchar', length: 60, nullable: true })
  platform: string | null;

  /** Lema/tagline de la landing. Null → tagline por defecto. */
  @Column({ name: 'tagline', type: 'varchar', length: 280, nullable: true })
  tagline: string | null;

  /** Entrada gratis (true) o de pago (false). Promo de la landing. */
  @Column({ name: 'entry_free', type: 'boolean', default: true })
  entryFree: boolean;

  /** Rango mínimo elegible (clave de PlayerRank, ej. "plat3"). */
  @Column({ name: 'min_rank', type: 'varchar', length: 20, default: 'plat3' })
  minRank: string;

  /** Rango máximo elegible (clave de PlayerRank, ej. "gc1"). */
  @Column({ name: 'max_rank', type: 'varchar', length: 20, default: 'gc1' })
  maxRank: string;

  /** Nº de equipos del torneo (16 ó 32). Define grupos y estructura de llave. */
  @Column({ name: 'team_capacity', type: 'int', default: 16 })
  teamCapacity: number;

  /** Jugadores por lado en cancha: 1 (1v1), 2 (2v2) ó 3 (3v3). */
  @Column({ name: 'players_per_side', type: 'int', default: 3 })
  playersPerSide: number;

  /** Suplentes por equipo (se suman a los titulares para el roster total). */
  @Column({ name: 'substitutes', type: 'int', default: 2 })
  substitutes: number;

  /** Cierre de inscripciones — alimenta el countdown de la landing. */
  @Column({ name: 'registration_deadline', type: 'timestamp', nullable: true })
  registrationDeadline: Date | null;

  // Formato de serie por fase eliminatoria (bo3 | bo5 | bo7). La fase de grupos
  // es siempre a partido único. Se aplican al generar la llave.
  @Column({ name: 'format_round16', type: 'varchar', length: 10, default: 'bo3' })
  formatRound16: string;

  @Column({ name: 'format_quarters', type: 'varchar', length: 10, default: 'bo3' })
  formatQuarters: string;

  @Column({ name: 'format_semis', type: 'varchar', length: 10, default: 'bo5' })
  formatSemis: string;

  @Column({ name: 'format_third', type: 'varchar', length: 10, default: 'bo7' })
  formatThird: string;

  @Column({ name: 'format_final', type: 'varchar', length: 10, default: 'bo7' })
  formatFinal: string;

  /**
   * Fechas de las fases del torneo para la línea de tiempo de la landing.
   * Mapa fase → fecha ISO `YYYY-MM-DD`. Las claves de fase eliminatoria
   * (round32/round16) solo aplican si la estructura clasifica suficientes
   * equipos; el front decide cuáles mostrar a partir del nº de grupos.
   * Claves: registrationOpen, registrationClose, groupDraw, groupStage,
   * round32, round16, quarters, semis, third, final.
   */
  @Column({ name: 'phase_dates', type: 'jsonb', nullable: true })
  phaseDates: Record<string, string> | null;

  // Premios por puesto (texto libre: "$ 300 USD", "Merch + rol", …). Editables
  // desde el admin; expuestos a cambios (de ahí la nota).
  @Column({ name: 'prize_first', type: 'varchar', length: 160, nullable: true })
  prizeFirst: string | null;

  @Column({ name: 'prize_second', type: 'varchar', length: 160, nullable: true })
  prizeSecond: string | null;

  @Column({ name: 'prize_third', type: 'varchar', length: 160, nullable: true })
  prizeThird: string | null;

  /** Nota al pie de los premios ("Premios sujetos a cambios"…). */
  @Column({ name: 'prize_note', type: 'varchar', length: 280, nullable: true })
  prizeNote: string | null;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
