import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Equipo del catálogo de "equipos predefinidos". Cuando el modo está activo
 * (TournamentSettings.predefinedTeamsMode), la inscripción y el reclutamiento
 * eligen uno de estos en vez de nombre+escudo libres. Editable desde el admin
 * (no tiene por qué ser la RLCS). Los escudos se guardan en
 * `UPLOAD_DIR/preset-teams/` y se sirven en `/uploads/preset-teams/<archivo>`.
 */
@Entity('preset_teams')
export class PresetTeam {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Identificador estable y legible (kebab-case). Único. */
  @Column({ type: 'varchar', length: 60, unique: true })
  slug: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  /** Región/liga (texto libre: "Europa", "Norteamérica", …). */
  @Column({ type: 'varchar', length: 80, nullable: true })
  region: string | null;

  /** Subtítulo de la tarjeta (ej. "Europa · 1º", "Repechaje · LCQ"). */
  @Column({ name: 'placement_label', type: 'varchar', length: 120, nullable: true })
  placementLabel: string | null;

  /** URL del escudo (ej. `/uploads/preset-teams/karmine-corp.png`). */
  @Column({ type: 'varchar', length: 500, nullable: true })
  logo: string | null;

  /** Orden de presentación (asc). */
  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
