import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { LinkedPlatform } from '../common/enums';
import { User } from './user.entity';

/**
 * Cuenta de plataforma (Steam/Epic) vinculada y VERIFICADA por OAuth/OpenID a
 * un usuario del torneo. El `platformId` (SteamID64 / Epic Account ID) es el
 * identificador estable que aparece en los replays: por aquí se resuelve
 * `replay → jugador → equipo` al cargar las estadísticas de partidos privados.
 *
 * - `Unique(platform, platformId)`: una misma cuenta de plataforma no puede
 *   reclamarla más de un usuario (evita que alguien "robe" stats ajenas).
 * - `Unique(userId, platform)`: un usuario tiene como mucho una cuenta por
 *   plataforma (puede tener una de Steam y una de Epic si juega en ambas).
 */
@Entity('linked_accounts')
@Unique(['platform', 'platformId'])
@Unique(['userId', 'platform'])
export class LinkedAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'enum', enum: LinkedPlatform })
  platform: LinkedPlatform;

  @Column({ name: 'platform_id', type: 'varchar', length: 100 })
  platformId: string;

  @Column({ name: 'display_name', type: 'varchar', length: 100, nullable: true })
  displayName: string | null;

  @Column({ name: 'verified_at', type: 'timestamp' })
  verifiedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
