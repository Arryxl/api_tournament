import { MatchFormat, MatchPhase } from './enums';

/**
 * Matemática del torneo, derivada del nº de equipos.
 *  - 16 equipos ⇒ 4 grupos (A–D) ⇒ cuartos → semis → final = 32 partidos.
 *  - 32 equipos ⇒ 8 grupos (A–H) ⇒ octavos → cuartos → semis → final = 64.
 * Estas funciones son la fuente de verdad para grupos y generación de llave.
 */

/** Nº de grupos = equipos / 4 (cada grupo es un round-robin de 4). */
export function groupCountFor(teamCount: number): number {
  return Math.max(1, Math.floor(teamCount / 4));
}

/** Letras de los grupos: 4 ⇒ [A,B,C,D]; 8 ⇒ [A..H]. */
export function groupLettersFor(teamCount: number): string[] {
  const n = groupCountFor(teamCount);
  return Array.from({ length: n }, (_, i) => String.fromCharCode(65 + i));
}

const pad2 = (n: number) => String(n).padStart(2, '0');

export interface MatchSkeleton {
  code: string;
  phase: MatchPhase;
  format: MatchFormat;
  group?: string;
  round?: number;
}

/**
 * Esqueleto completo de partidos para `teamCount` equipos: partidos de grupo
 * (G{letra}-1..6) + llave eliminatoria. Sin equipos ni fechas.
 */
export function buildMatchSkeleton(teamCount: number): MatchSkeleton[] {
  const letters = groupLettersFor(teamCount);
  const list: MatchSkeleton[] = [];

  // --- Fase de grupos: round-robin de 4 ⇒ 6 partidos por grupo ---
  for (const g of letters) {
    for (let i = 1; i <= 6; i++) {
      list.push({
        code: `G${g}-${i}`,
        phase: MatchPhase.GROUPS,
        format: MatchFormat.BO3,
        group: g,
        round: Math.ceil(i / 2),
      });
    }
  }

  // --- Llave eliminatoria ---
  // Clasifican 2 por grupo. Con 8 grupos (32 equipos) hay octavos.
  const qualified = letters.length * 2;
  if (qualified >= 16) {
    for (let i = 1; i <= 8; i++) {
      list.push({ code: `R${pad2(i)}`, phase: MatchPhase.ROUND16, format: MatchFormat.BO3 });
    }
  }
  for (let i = 1; i <= 4; i++) {
    list.push({ code: `Q${pad2(i)}`, phase: MatchPhase.QUARTERS, format: MatchFormat.BO3 });
  }
  list.push({ code: 'SF1', phase: MatchPhase.SEMIS, format: MatchFormat.BO5 });
  list.push({ code: 'SF2', phase: MatchPhase.SEMIS, format: MatchFormat.BO5 });
  list.push({ code: '3L', phase: MatchPhase.THIRD, format: MatchFormat.BO7 });
  list.push({ code: 'GF', phase: MatchPhase.FINAL, format: MatchFormat.BO7 });

  return list;
}

/** Total de partidos esperados para `teamCount` (24+8=32 ó 48+16=64). */
export function expectedMatchCount(teamCount: number): number {
  return buildMatchSkeleton(teamCount).length;
}
