import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TransactionType } from '../common/enums';
import { User } from './user.entity';
import { Match } from './match.entity';

@Entity('coin_transactions')
export class CoinTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'int' })
  amount: number;

  @Column({ type: 'varchar', length: 200 })
  concept: string;

  @Column({ name: 'transaction_type', type: 'enum', enum: TransactionType })
  transactionType: TransactionType;

  @Column({ name: 'match_id', type: 'uuid', nullable: true })
  matchId: string | null;

  @ManyToOne(() => Match, { nullable: true })
  @JoinColumn({ name: 'match_id' })
  match: Match | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
