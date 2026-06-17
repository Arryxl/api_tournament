import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { RegistrationStatus } from '../common/enums';
import { User } from './user.entity';

@Entity('registration_forms')
export class RegistrationForm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'team_name', type: 'varchar', length: 100 })
  teamName: string;

  @Column({ name: 'shield_url', type: 'varchar', length: 500, nullable: true })
  shieldUrl: string | null;

  @Column({ name: 'player1_epic', type: 'varchar', length: 100, nullable: true })
  player1Epic: string | null;
  @Column({ name: 'player1_steam', type: 'varchar', length: 100, nullable: true })
  player1Steam: string | null;
  @Column({ name: 'player1_rank', type: 'varchar', length: 20, nullable: true })
  player1Rank: string | null;
  @Column({ name: 'player1_screenshot', type: 'varchar', length: 500, nullable: true })
  player1Screenshot: string | null;

  @Column({ name: 'player2_epic', type: 'varchar', length: 100, nullable: true })
  player2Epic: string | null;
  @Column({ name: 'player2_steam', type: 'varchar', length: 100, nullable: true })
  player2Steam: string | null;
  @Column({ name: 'player2_rank', type: 'varchar', length: 20, nullable: true })
  player2Rank: string | null;
  @Column({ name: 'player2_screenshot', type: 'varchar', length: 500, nullable: true })
  player2Screenshot: string | null;

  @Column({ name: 'player3_epic', type: 'varchar', length: 100, nullable: true })
  player3Epic: string | null;
  @Column({ name: 'player3_steam', type: 'varchar', length: 100, nullable: true })
  player3Steam: string | null;
  @Column({ name: 'player3_rank', type: 'varchar', length: 20, nullable: true })
  player3Rank: string | null;
  @Column({ name: 'player3_screenshot', type: 'varchar', length: 500, nullable: true })
  player3Screenshot: string | null;

  // Suplentes (jugadores 4 y 5) — mismos requisitos que los titulares.
  @Column({ name: 'player4_epic', type: 'varchar', length: 100, nullable: true })
  player4Epic: string | null;
  @Column({ name: 'player4_steam', type: 'varchar', length: 100, nullable: true })
  player4Steam: string | null;
  @Column({ name: 'player4_rank', type: 'varchar', length: 20, nullable: true })
  player4Rank: string | null;
  @Column({ name: 'player4_screenshot', type: 'varchar', length: 500, nullable: true })
  player4Screenshot: string | null;

  @Column({ name: 'player5_epic', type: 'varchar', length: 100, nullable: true })
  player5Epic: string | null;
  @Column({ name: 'player5_steam', type: 'varchar', length: 100, nullable: true })
  player5Steam: string | null;
  @Column({ name: 'player5_rank', type: 'varchar', length: 20, nullable: true })
  player5Rank: string | null;
  @Column({ name: 'player5_screenshot', type: 'varchar', length: 500, nullable: true })
  player5Screenshot: string | null;

  @Column({ name: 'captain_player', type: 'int', nullable: true })
  captainPlayer: number | null;

  @Column({ type: 'enum', enum: RegistrationStatus, default: RegistrationStatus.PENDING })
  status: RegistrationStatus;

  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason: string | null;

  @CreateDateColumn({ name: 'submitted_at' })
  submittedAt: Date;

  @Column({ name: 'reviewed_at', type: 'timestamp', nullable: true })
  reviewedAt: Date | null;

  @Column({ name: 'reviewed_by', type: 'uuid', nullable: true })
  reviewedBy: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'reviewed_by' })
  reviewer: User | null;
}
