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

  // IDs de consola por jugador (PSN online ID / Xbox gamertag / Switch). Se
  // copian a team_member y se vinculan (sin verificar) al aprobar, para cruzar
  // las stats de jugadores de consola en los replays.
  @Column({ name: 'player1_psn', type: 'varchar', length: 100, nullable: true })
  player1Psn: string | null;
  @Column({ name: 'player1_xbox', type: 'varchar', length: 100, nullable: true })
  player1Xbox: string | null;
  @Column({ name: 'player1_switch', type: 'varchar', length: 100, nullable: true })
  player1Switch: string | null;

  @Column({ name: 'player2_psn', type: 'varchar', length: 100, nullable: true })
  player2Psn: string | null;
  @Column({ name: 'player2_xbox', type: 'varchar', length: 100, nullable: true })
  player2Xbox: string | null;
  @Column({ name: 'player2_switch', type: 'varchar', length: 100, nullable: true })
  player2Switch: string | null;

  @Column({ name: 'player3_psn', type: 'varchar', length: 100, nullable: true })
  player3Psn: string | null;
  @Column({ name: 'player3_xbox', type: 'varchar', length: 100, nullable: true })
  player3Xbox: string | null;
  @Column({ name: 'player3_switch', type: 'varchar', length: 100, nullable: true })
  player3Switch: string | null;

  @Column({ name: 'player4_psn', type: 'varchar', length: 100, nullable: true })
  player4Psn: string | null;
  @Column({ name: 'player4_xbox', type: 'varchar', length: 100, nullable: true })
  player4Xbox: string | null;
  @Column({ name: 'player4_switch', type: 'varchar', length: 100, nullable: true })
  player4Switch: string | null;

  @Column({ name: 'player5_psn', type: 'varchar', length: 100, nullable: true })
  player5Psn: string | null;
  @Column({ name: 'player5_xbox', type: 'varchar', length: 100, nullable: true })
  player5Xbox: string | null;
  @Column({ name: 'player5_switch', type: 'varchar', length: 100, nullable: true })
  player5Switch: string | null;

  // Cuando la inscripción proviene del módulo de reclutamiento, cada jugador
  // ya tiene cuenta: estos campos enlazan al usuario existente para que la
  // aprobación NO genere credenciales nuevas sino que vincule la cuenta.
  @Column({ name: 'player1_user_id', type: 'uuid', nullable: true })
  player1UserId: string | null;
  @Column({ name: 'player2_user_id', type: 'uuid', nullable: true })
  player2UserId: string | null;
  @Column({ name: 'player3_user_id', type: 'uuid', nullable: true })
  player3UserId: string | null;
  @Column({ name: 'player4_user_id', type: 'uuid', nullable: true })
  player4UserId: string | null;
  @Column({ name: 'player5_user_id', type: 'uuid', nullable: true })
  player5UserId: string | null;

  @Column({ name: 'captain_player', type: 'int', nullable: true })
  captainPlayer: number | null;

  // Medio por el que el admin enviará la respuesta y las credenciales de
  // ingreso al torneo: 'discord' | 'email'.
  @Column({ name: 'contact_method', type: 'varchar', length: 20, nullable: true })
  contactMethod: string | null;

  @Column({ name: 'contact_value', type: 'varchar', length: 150, nullable: true })
  contactValue: string | null;

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
