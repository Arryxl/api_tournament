/**
 * Semilla del catálogo de equipos predefinidos (RLCS 2026). YA NO es la fuente
 * de verdad en runtime: el catálogo vive en la tabla `preset_teams` y es
 * editable desde el admin. Esto solo se usa para sembrar los 16 equipos por
 * defecto (script `seed-preset-teams.ts`).
 *
 * Cada `slug` coincide con el nombre de archivo del escudo empaquetado en
 * `src/assets/teams/<slug>.png`, que el seed copia a `UPLOAD_DIR/preset-teams/`.
 */
export interface PresetSeed {
  slug: string;
  name: string;
  region: string;
  placementLabel: string;
}

export const PRESET_TEAMS_SEED: PresetSeed[] = [
  { slug: 'karmine-corp', name: 'Karmine Corp', region: 'Europa', placementLabel: 'Europa · 1º' },
  { slug: 'gentle-mates', name: 'Gentle Mates', region: 'Europa', placementLabel: 'Europa · 2º' },
  { slug: 'team-vitality', name: 'Team Vitality', region: 'Europa', placementLabel: 'Europa · 3º' },
  { slug: 'ninjas-in-pyjamas', name: 'Ninjas in Pyjamas', region: 'Europa', placementLabel: 'Europa · 4º' },
  { slug: 'man-city-esports', name: 'Man City Esports', region: 'Europa', placementLabel: 'Europa · 5º' },
  { slug: 'nrg', name: 'NRG', region: 'Norteamérica', placementLabel: 'Norteamérica · 1º' },
  { slug: 'shopify-rebellion', name: 'Shopify Rebellion', region: 'Norteamérica', placementLabel: 'Norteamérica · 2º' },
  { slug: 'spacestation-gaming', name: 'Spacestation Gaming', region: 'Norteamérica', placementLabel: 'Norteamérica · 3º' },
  { slug: 'mibr', name: 'MIBR', region: 'Sudamérica', placementLabel: 'Sudamérica · 1º' },
  { slug: 'furia', name: 'FURIA', region: 'Sudamérica', placementLabel: 'Sudamérica · 2º' },
  { slug: 'twisted-minds', name: 'Twisted Minds', region: 'MENA', placementLabel: 'MENA · 1º' },
  { slug: 'team-falcons', name: 'Team Falcons', region: 'MENA', placementLabel: 'MENA · 2º' },
  { slug: 'tsm', name: 'TSM', region: 'Asia-Pacífico', placementLabel: 'Asia-Pacífico · 1º' },
  { slug: 'five-fears', name: 'Five Fears', region: 'África Subsahariana', placementLabel: 'África Subsahariana · 1º' },
  { slug: 'virtus-pro', name: 'Virtus.pro', region: 'Repechaje', placementLabel: 'Repechaje · LCQ' },
  { slug: 'pwr', name: 'PWR', region: 'Repechaje', placementLabel: 'Repechaje · LCQ' },
];

/** kebab-case estable a partir de un nombre (para nuevos equipos del admin). */
export function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}
