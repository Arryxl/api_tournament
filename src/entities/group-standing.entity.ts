import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Group } from './group.entity';
import { Team } from './team.entity';

@Entity('group_standings')
export class GroupStanding {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'group_id', type: 'uuid' })
  groupId: string;

  @ManyToOne(() => Group)
  @JoinColumn({ name: 'group_id' })
  group: Group;

  @Column({ name: 'team_id', type: 'uuid' })
  teamId: string;

  @ManyToOne(() => Team)
  @JoinColumn({ name: 'team_id' })
  team: Team;

  @Column({ type: 'int', default: 0 })
  played: number;

  @Column({ type: 'int', default: 0 })
  won: number;

  @Column({ type: 'int', default: 0 })
  drawn: number;

  @Column({ type: 'int', default: 0 })
  lost: number;

  @Column({ name: 'goals_for', type: 'int', default: 0 })
  goalsFor: number;

  @Column({ name: 'goals_against', type: 'int', default: 0 })
  goalsAgainst: number;

  @Column({ type: 'int', default: 0 })
  points: number;

  @Column({ type: 'int', nullable: true })
  position: number | null;
}
