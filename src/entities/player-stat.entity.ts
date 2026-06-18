import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Match } from './match.entity';
import { User } from './user.entity';
import { Team } from './team.entity';

@Entity('player_stats')
@Unique(['matchId', 'userId'])
export class PlayerStat {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'match_id', type: 'uuid' })
  matchId: string;

  @ManyToOne(() => Match, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'match_id' })
  match: Match;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'team_id', type: 'uuid' })
  teamId: string;

  @ManyToOne(() => Team)
  @JoinColumn({ name: 'team_id' })
  team: Team;

  @Column({ type: 'int', default: 0 })
  goals: number;

  @Column({ type: 'int', default: 0 })
  assists: number;

  @Column({ type: 'int', default: 0 })
  saves: number;

  @Column({ type: 'int', default: 0 })
  score: number;

  @Column({ type: 'int', default: 0 })
  shots: number;

  @Column({ type: 'int', default: 0 })
  demos: number;

  @Column({ type: 'boolean', default: false })
  mvp: boolean;

  // Métricas avanzadas del replay (boost/movimiento/posicionamiento). Null si
  // la stat se cargó a mano sin replay. Estructura: PlayerExtraStats.
  @Column({ name: 'extra', type: 'jsonb', nullable: true })
  extra: unknown | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
