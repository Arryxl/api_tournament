import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { MatchFormat, MatchPhase, MatchStatus } from '../common/enums';
import { Team } from './team.entity';
import { Group } from './group.entity';

@Entity('matches')
export class Match {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'match_code', type: 'varchar', length: 10, unique: true })
  matchCode: string;

  @Column({ type: 'enum', enum: MatchPhase })
  phase: MatchPhase;

  @Column({ name: 'team_home_id', type: 'uuid', nullable: true })
  teamHomeId: string | null;

  @ManyToOne(() => Team, { nullable: true })
  @JoinColumn({ name: 'team_home_id' })
  teamHome: Team | null;

  @Column({ name: 'team_away_id', type: 'uuid', nullable: true })
  teamAwayId: string | null;

  @ManyToOne(() => Team, { nullable: true })
  @JoinColumn({ name: 'team_away_id' })
  teamAway: Team | null;

  @Column({ name: 'home_score', type: 'int', nullable: true })
  homeScore: number | null;

  @Column({ name: 'away_score', type: 'int', nullable: true })
  awayScore: number | null;

  @Column({ name: 'winner_id', type: 'uuid', nullable: true })
  winnerId: string | null;

  @Column({ name: 'scheduled_at', type: 'timestamp', nullable: true })
  scheduledAt: Date | null;

  @Column({ name: 'played_at', type: 'timestamp', nullable: true })
  playedAt: Date | null;

  @Column({ type: 'enum', enum: MatchStatus, default: MatchStatus.SCHEDULED })
  status: MatchStatus;

  @Column({ type: 'enum', enum: MatchFormat })
  format: MatchFormat;

  @Column({ name: 'group_id', type: 'uuid', nullable: true })
  groupId: string | null;

  @ManyToOne(() => Group, { nullable: true })
  @JoinColumn({ name: 'group_id' })
  group: Group | null;

  @Column({ name: 'round_number', type: 'int', nullable: true })
  roundNumber: number | null;

  @Column({ name: 'predictions_open', type: 'boolean', default: false })
  predictionsOpen: boolean;
}
