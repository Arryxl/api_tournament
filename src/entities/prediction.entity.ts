import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { User } from './user.entity';
import { Match } from './match.entity';
import { Team } from './team.entity';

@Entity('predictions')
@Unique(['userId', 'matchId'])
export class Prediction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'match_id', type: 'uuid' })
  matchId: string;

  @ManyToOne(() => Match)
  @JoinColumn({ name: 'match_id' })
  match: Match;

  @Column({ name: 'predicted_winner_id', type: 'uuid', nullable: true })
  predictedWinnerId: string | null;

  @ManyToOne(() => Team, { nullable: true })
  @JoinColumn({ name: 'predicted_winner_id' })
  predictedWinner: Team | null;

  @Column({ name: 'predicted_home_score', type: 'int', nullable: true })
  predictedHomeScore: number | null;

  @Column({ name: 'predicted_away_score', type: 'int', nullable: true })
  predictedAwayScore: number | null;

  @Column({ name: 'is_correct', type: 'boolean', nullable: true })
  isCorrect: boolean | null;

  @Column({ name: 'coins_earned', type: 'int', default: 0 })
  coinsEarned: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
