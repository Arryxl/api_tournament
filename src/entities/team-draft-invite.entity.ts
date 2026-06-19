import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { RequestStatus } from '../common/enums';
import { User } from './user.entity';
import { TeamDraft } from './team-draft.entity';

/**
 * Invitación a un jugador para unirse a un equipo en formación. El orden de
 * aceptación (`acceptedAt`) define quién es titular y quién suplente: el
 * capitán es el primer titular y los siguientes en aceptar completan los
 * titulares; el resto entra como suplente.
 */
@Entity('team_draft_invites')
export class TeamDraftInvite {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'draft_id', type: 'uuid' })
  draftId: string;

  @ManyToOne(() => TeamDraft, (draft) => draft.invites, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'draft_id' })
  draft: TeamDraft;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'enum', enum: RequestStatus, default: RequestStatus.PENDING })
  status: RequestStatus;

  @Column({ name: 'accepted_at', type: 'timestamp', nullable: true })
  acceptedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
