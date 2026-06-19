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
