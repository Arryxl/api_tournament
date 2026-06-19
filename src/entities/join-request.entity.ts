import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import {
  JoinDirection,
  PlayerRank,
  RequestStatus,
} from '../common/enums';
import { User } from './user.entity';
import { Team } from './team.entity';
import { RecruitmentPost } from './recruitment-post.entity';

/**
 * Solicitud dirigida de unión de un jugador a un equipo. La resuelve el
 * receptor según la dirección:
 *  - PLAYER_TO_TEAM: la creó el jugador; la acepta/rechaza el capitán.
 *  - TEAM_TO_PLAYER: la creó el capitán (invitación); la acepta/rechaza el jugador.
 *
 * Lleva embebidos los datos de inscripción del jugador (Epic/Steam/rango/
 * captura) para que el capitán evalúe sin salir de la plataforma. Al aceptar,
 * estos datos alimentan el `TeamMember` vía `addExistingUserAsMember`.
 */
@Entity('join_requests')
export class JoinRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: JoinDirection })
  direction: JoinDirection;

  @Column({ type: 'enum', enum: RequestStatus, default: RequestStatus.PENDING })
  status: RequestStatus;

  @Column({ name: 'team_id', type: 'uuid' })
  teamId: string;

  @ManyToOne(() => Team, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'team_id' })
  team: Team;

  @Column({ name: 'applicant_id', type: 'uuid' })
  applicantId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'applicant_id' })
  applicant: User;

  @Column({ name: 'epic_username', type: 'varchar', length: 100, nullable: true })
  epicUsername: string | null;

  @Column({ name: 'steam_username', type: 'varchar', length: 100, nullable: true })
  steamUsername: string | null;

  @Column({ type: 'enum', enum: PlayerRank, nullable: true })
  rank: PlayerRank | null;

  @Column({ name: 'screenshot_url', type: 'varchar', length: 500, nullable: true })
  screenshotUrl: string | null;

  @Column({ name: 'source_post_id', type: 'uuid', nullable: true })
  sourcePostId: string | null;

  @ManyToOne(() => RecruitmentPost, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'source_post_id' })
  sourcePost: RecruitmentPost | null;

  @Column({ type: 'text', nullable: true })
  message: string | null;

  @Column({ name: 'resolved_at', type: 'timestamp', nullable: true })
  resolvedAt: Date | null;

  @Column({ name: 'resolved_by', type: 'uuid', nullable: true })
  resolvedBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
