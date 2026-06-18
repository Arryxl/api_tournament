import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ReplayStatus } from '../common/enums';
import { Match } from './match.entity';
import { User } from './user.entity';

/**
 * Un archivo `.replay` subido por un capitán/admin. Lleva la trazabilidad de
 * la ingesta: id en ballchasing, hash para deduplicar, estado del match/import
 * y, si quedó pendiente, el motivo para la cola de revisión. `rawStats` guarda
 * el desglose parseado (equipos/jugadores) para poder revisarlo a mano.
 */
@Entity('replays')
export class Replay {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'match_id', type: 'uuid', nullable: true })
  matchId: string | null;

  @ManyToOne(() => Match, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'match_id' })
  match: Match | null;

  @Column({ name: 'uploaded_by_id', type: 'uuid', nullable: true })
  uploadedById: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'uploaded_by_id' })
  uploadedBy: User | null;

  @Column({ name: 'ballchasing_id', type: 'varchar', length: 100, nullable: true })
  ballchasingId: string | null;

  @Column({ name: 'file_hash', type: 'varchar', length: 64, unique: true })
  fileHash: string;

  @Column({ name: 'original_name', type: 'varchar', length: 260, nullable: true })
  originalName: string | null;

  @Column({ type: 'enum', enum: ReplayStatus, default: ReplayStatus.PROCESSING })
  status: ReplayStatus;

  @Column({ name: 'home_score', type: 'int', nullable: true })
  homeScore: number | null;

  @Column({ name: 'away_score', type: 'int', nullable: true })
  awayScore: number | null;

  @Column({ name: 'review_reason', type: 'text', nullable: true })
  reviewReason: string | null;

  @Column({ name: 'raw_stats', type: 'jsonb', nullable: true })
  rawStats: unknown | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'processed_at', type: 'timestamp', nullable: true })
  processedAt: Date | null;
}
