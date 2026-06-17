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

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
