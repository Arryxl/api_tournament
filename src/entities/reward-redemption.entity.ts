import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { RedemptionStatus } from '../common/enums';
import { User } from './user.entity';
import { Reward } from './reward.entity';

@Entity('reward_redemptions')
export class RewardRedemption {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'reward_id', type: 'uuid' })
  rewardId: string;

  @ManyToOne(() => Reward)
  @JoinColumn({ name: 'reward_id' })
  reward: Reward;

  @Column({ type: 'enum', enum: RedemptionStatus, default: RedemptionStatus.PENDING })
  status: RedemptionStatus;

  @CreateDateColumn({ name: 'redeemed_at' })
  redeemedAt: Date;

  @Column({ type: 'text', nullable: true })
  notes: string | null;
}
