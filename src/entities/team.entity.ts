import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TeamStatus } from '../common/enums';
import { User } from './user.entity';
import { Group } from './group.entity';
import { TeamMember } from './team-member.entity';

@Entity('teams')
export class Team {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  name: string;

  @Column({ name: 'shield_url', type: 'varchar', length: 500, nullable: true })
  shieldUrl: string | null;

  @Column({ name: 'captain_id', type: 'uuid', nullable: true })
  captainId: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'captain_id' })
  captain: User | null;

  @Column({ name: 'group_id', type: 'uuid', nullable: true })
  groupId: string | null;

  @ManyToOne(() => Group, { nullable: true })
  @JoinColumn({ name: 'group_id' })
  group: Group | null;

  @Column({ type: 'enum', enum: TeamStatus, default: TeamStatus.PENDING })
  status: TeamStatus;

  @OneToMany(() => TeamMember, (member) => member.team)
  members: TeamMember[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
