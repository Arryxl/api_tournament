import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PlayerPosition, PlayerRank } from '../common/enums';
import { User } from './user.entity';

/**
 * Datos de juego del usuario (1:1 con User). Son la fuente única de verdad para
 * el reclutamiento: al publicar ficha, postularse, invitar o formar equipo, se
 * copian desde aquí en lugar de pedirse en cada acción. El perfil debe estar
 * "completo" (al menos un usuario de plataforma + rango + captura) para poder
 * participar en el reclutamiento.
 */
@Entity('player_profiles')
export class PlayerProfile {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'epic_username', type: 'varchar', length: 100, nullable: true })
  epicUsername: string | null;

  @Column({ name: 'steam_username', type: 'varchar', length: 100, nullable: true })
  steamUsername: string | null;

  @Column({ type: 'enum', enum: PlayerRank, nullable: true })
  rank: PlayerRank | null;

  @Column({ name: 'screenshot_url', type: 'varchar', length: 500, nullable: true })
  screenshotUrl: string | null;

  @Column({ type: 'enum', enum: PlayerPosition, nullable: true })
  position: PlayerPosition | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  region: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  availability: string | null;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
