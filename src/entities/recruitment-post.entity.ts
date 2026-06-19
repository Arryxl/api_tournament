import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  PlayerPosition,
  PlayerRank,
  RecruitmentStatus,
  RecruitmentType,
} from '../common/enums';
import { User } from './user.entity';
import { Team } from './team.entity';

/**
 * Anuncio del tablón de reclutamiento (LFT / mercado de fichajes).
 * Una sola tabla cubre los dos sentidos del mercado según `type`:
 *  - PLAYER_LFT: jugador libre. Usa epic, steam, rank, screenshot y position
 *    (rango y captura los verá el capitán que lo invite).
 *  - TEAM_LFP: equipo buscando. Usa team, teamName, lookingFor* y slotsNeeded.
 */
@Entity('recruitment_posts')
export class RecruitmentPost {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: RecruitmentType })
  type: RecruitmentType;

  @Column({ name: 'author_id', type: 'uuid' })
  authorId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'author_id' })
  author: User;

  @Column({ type: 'enum', enum: RecruitmentStatus, default: RecruitmentStatus.OPEN })
  status: RecruitmentStatus;

  @Column({ type: 'text', nullable: true })
  message: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  region: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  availability: string | null;

  // -------- Solo PLAYER_LFT --------
  @Column({ name: 'epic_username', type: 'varchar', length: 100, nullable: true })
  epicUsername: string | null;

  @Column({ name: 'steam_username', type: 'varchar', length: 100, nullable: true })
  steamUsername: string | null;

  @Column({ type: 'enum', enum: PlayerRank, nullable: true })
  rank: PlayerRank | null;

  @Column({ name: 'screenshot_url', type: 'varchar', length: 500, nullable: true })
  screenshotUrl: string | null;

  @Column({ type: 'enum', enum: PlayerPosition, nullable: true })
  position: PlayerPosition | null;

  // -------- Solo TEAM_LFP --------
  @Column({ name: 'team_id', type: 'uuid', nullable: true })
  teamId: string | null;

  @ManyToOne(() => Team, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'team_id' })
  team: Team | null;

  @Column({ name: 'team_name', type: 'varchar', length: 100, nullable: true })
  teamName: string | null;

  @Column({ name: 'looking_for_rank', type: 'enum', enum: PlayerRank, nullable: true })
  lookingForRank: PlayerRank | null;

  @Column({
    name: 'looking_for_position',
    type: 'enum',
    enum: PlayerPosition,
    nullable: true,
  })
  lookingForPosition: PlayerPosition | null;

  @Column({ name: 'slots_needed', type: 'int', default: 1 })
  slotsNeeded: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
