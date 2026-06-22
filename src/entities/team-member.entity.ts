import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { PlayerRank } from '../common/enums';
import { Team } from './team.entity';
import { User } from './user.entity';

@Entity('team_members')
@Unique(['teamId', 'playerNumber'])
export class TeamMember {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'team_id', type: 'uuid' })
  teamId: string;

  @ManyToOne(() => Team, (team) => team.members, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'team_id' })
  team: Team;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  @Column({ name: 'epic_username', type: 'varchar', length: 100, nullable: true })
  epicUsername: string | null;

  @Column({ name: 'steam_username', type: 'varchar', length: 100, nullable: true })
  steamUsername: string | null;

  // IDs de consola (online ID / gamertag). No se verifican por OAuth; el ID
  // declarado es el que aparece en el replay y sirve para cruzar las stats.
  @Column({ name: 'psn_username', type: 'varchar', length: 100, nullable: true })
  psnUsername: string | null;

  @Column({ name: 'xbox_username', type: 'varchar', length: 100, nullable: true })
  xboxUsername: string | null;

  @Column({ name: 'switch_username', type: 'varchar', length: 100, nullable: true })
  switchUsername: string | null;

  @Column({ type: 'enum', enum: PlayerRank, nullable: true })
  rank: PlayerRank | null;

  @Column({ name: 'screenshot_url', type: 'varchar', length: 500, nullable: true })
  screenshotUrl: string | null;

  @Column({ name: 'is_captain', type: 'boolean', default: false })
  isCaptain: boolean;

  @Column({ name: 'player_number', type: 'int' })
  playerNumber: number;
}
