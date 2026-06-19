import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TeamDraftStatus } from '../common/enums';
import { User } from './user.entity';
import { Team } from './team.entity';
import { RegistrationForm } from './registration-form.entity';
import { TeamDraftInvite } from './team-draft-invite.entity';

/**
 * Equipo en formación. El capitán define nombre + escudo + contacto e invita a
 * jugadores del tablón. Permanece PENDING mientras junta gente; al completarse
 * los titulares (`requiredStarters`) se POSTULA como inscripción
 * (`RegistrationForm`) que el admin aprueba con el mismo flujo que el registro
 * tradicional. El reclutamiento es solo el intermediario que arma el equipo.
 */
@Entity('team_drafts')
export class TeamDraft {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'captain_id', type: 'uuid' })
  captainId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'captain_id' })
  captain: User;

  @Column({ name: 'team_name', type: 'varchar', length: 100 })
  teamName: string;

  @Column({ name: 'shield_url', type: 'varchar', length: 500, nullable: true })
  shieldUrl: string | null;

  @Column({ name: 'contact_method', type: 'varchar', length: 20, nullable: true })
  contactMethod: string | null;

  @Column({ name: 'contact_value', type: 'varchar', length: 150, nullable: true })
  contactValue: string | null;

  @Column({ name: 'required_starters', type: 'int' })
  requiredStarters: number;

  @Column({ name: 'max_roster', type: 'int' })
  maxRoster: number;

  @Column({ type: 'enum', enum: TeamDraftStatus, default: TeamDraftStatus.PENDING })
  status: TeamDraftStatus;

  @Column({ name: 'team_id', type: 'uuid', nullable: true })
  teamId: string | null;

  @ManyToOne(() => Team, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'team_id' })
  team: Team | null;

  // Inscripción generada al completarse (se resuelve en /admin/registrations).
  @Column({ name: 'registration_id', type: 'uuid', nullable: true })
  registrationId: string | null;

  @ManyToOne(() => RegistrationForm, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'registration_id' })
  registration: RegistrationForm | null;

  @OneToMany(() => TeamDraftInvite, (invite) => invite.draft)
  invites: TeamDraftInvite[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt: Date | null;
}
