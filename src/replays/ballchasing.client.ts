import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';

const BASE = 'https://ballchasing.com/api';

/** Color de equipo en un replay de ballchasing. */
export type ReplayColor = 'blue' | 'orange';

/**
 * Métricas avanzadas de ballchasing que guardamos en `player_stats.extra`
 * (jsonb) para graficar en el front. Subconjunto legible de boost/movimiento/
 * posicionamiento; los porcentajes ya vienen en 0–100.
 */
export interface PlayerExtraStats {
  boost: {
    bpm: number; // boost por minuto
    avgAmount: number; // boost medio disponible
    amountCollected: number;
    amountStolen: number;
    timeZeroBoost: number; // segundos sin boost
    timeFullBoost: number; // segundos a tope
  };
  movement: {
    avgSpeed: number;
    totalDistance: number;
    timeSupersonic: number;
    timeGround: number;
    timeLowAir: number;
    timeHighAir: number;
    percentGround: number;
    percentLowAir: number;
    percentHighAir: number;
  };
  positioning: {
    avgDistanceToBall: number;
    timeDefensiveThird: number;
    timeNeutralThird: number;
    timeOffensiveThird: number;
    timeBehindBall: number;
    timeInfrontBall: number;
    percentDefensiveThird: number;
    percentOffensiveThird: number;
    percentBehindBall: number;
    percentInfrontBall: number;
  };
}

export interface BallchasingPlayer {
  name: string;
  platform: string; // 'steam' | 'epic' | 'ps4' | 'xbox' | ...
  platformId: string;
  color: ReplayColor;
  mvp: boolean;
  goals: number;
  assists: number;
  saves: number;
  shots: number;
  score: number;
  demos: number;
  extra: PlayerExtraStats;
}

export interface ParsedReplay {
  status: string; // 'ok' | 'pending' | 'failed'
  blueGoals: number;
  orangeGoals: number;
  players: BallchasingPlayer[];
}

/**
 * Cliente HTTP de ballchasing.com. Sube el `.replay` y consulta el resultado
 * parseado. La API key se obtiene gratis en la página de subida de
 * ballchasing (login con Steam/Epic) → variable `BALLCHASING_API_KEY`.
 */
@Injectable()
export class BallchasingClient {
  private key(): string {
    const key = process.env.BALLCHASING_API_KEY;
    if (!key) {
      throw new InternalServerErrorException(
        'BALLCHASING_API_KEY no está configurado',
      );
    }
    return key;
  }

  /**
   * Sube un replay. Devuelve el id de ballchasing y si era duplicado (en cuyo
   * caso ballchasing devuelve 409 con el id del replay ya existente).
   */
  async upload(
    buffer: Buffer,
    filename: string,
  ): Promise<{ id: string; duplicate: boolean }> {
    const form = new FormData();
    form.append(
      'file',
      new Blob([new Uint8Array(buffer)], { type: 'application/octet-stream' }),
      filename,
    );

    const res = await fetch(`${BASE}/v2/upload?visibility=private`, {
      method: 'POST',
      headers: { Authorization: this.key() },
      body: form,
    });
    const data: any = await res.json().catch(() => ({}));

    if (res.status === 201) return { id: data.id, duplicate: false };
    if (res.status === 409 && data?.id) return { id: data.id, duplicate: true };
    throw new BadRequestException(
      `ballchasing rechazó el replay (${res.status}): ${data?.error || 'error desconocido'}`,
    );
  }

  /** Obtiene el replay parseado y lo normaliza a nuestra forma. */
  async getReplay(id: string): Promise<ParsedReplay> {
    const res = await fetch(`${BASE}/replays/${id}`, {
      headers: { Authorization: this.key() },
    });
    if (!res.ok) {
      throw new BadRequestException(
        `No se pudo leer el replay de ballchasing (${res.status})`,
      );
    }
    const data: any = await res.json();
    return this.normalize(data);
  }

  private normalize(data: any): ParsedReplay {
    const players: BallchasingPlayer[] = [];
    for (const color of ['blue', 'orange'] as ReplayColor[]) {
      const team = data?.[color];
      for (const p of team?.players ?? []) {
        const s = p?.stats ?? {};
        const core = s.core ?? {};
        const boost = s.boost ?? {};
        const mv = s.movement ?? {};
        const pos = s.positioning ?? {};
        players.push({
          name: p?.name ?? '',
          platform: p?.id?.platform ?? '',
          platformId: String(p?.id?.id ?? ''),
          color,
          mvp: !!p?.mvp,
          goals: core.goals ?? 0,
          assists: core.assists ?? 0,
          saves: core.saves ?? 0,
          shots: core.shots ?? 0,
          score: core.score ?? 0,
          demos: s.demo?.inflicted ?? 0,
          extra: {
            boost: {
              bpm: boost.bpm ?? 0,
              avgAmount: boost.avg_amount ?? 0,
              amountCollected: boost.amount_collected ?? 0,
              amountStolen: boost.amount_stolen ?? 0,
              timeZeroBoost: boost.time_zero_boost ?? 0,
              timeFullBoost: boost.time_full_boost ?? 0,
            },
            movement: {
              avgSpeed: mv.avg_speed ?? 0,
              totalDistance: mv.total_distance ?? 0,
              timeSupersonic: mv.time_supersonic_speed ?? 0,
              timeGround: mv.time_ground ?? 0,
              timeLowAir: mv.time_low_air ?? 0,
              timeHighAir: mv.time_high_air ?? 0,
              percentGround: mv.percent_ground ?? 0,
              percentLowAir: mv.percent_low_air ?? 0,
              percentHighAir: mv.percent_high_air ?? 0,
            },
            positioning: {
              avgDistanceToBall: pos.avg_distance_to_ball ?? 0,
              timeDefensiveThird: pos.time_defensive_third ?? 0,
              timeNeutralThird: pos.time_neutral_third ?? 0,
              timeOffensiveThird: pos.time_offensive_third ?? 0,
              timeBehindBall: pos.time_behind_ball ?? 0,
              timeInfrontBall: pos.time_infront_ball ?? 0,
              percentDefensiveThird: pos.percent_defensive_third ?? 0,
              percentOffensiveThird: pos.percent_offensive_third ?? 0,
              percentBehindBall: pos.percent_behind_ball ?? 0,
              percentInfrontBall: pos.percent_infront_ball ?? 0,
            },
          },
        });
      }
    }
    return {
      status: data?.status ?? 'pending',
      blueGoals: data?.blue?.stats?.core?.goals ?? 0,
      orangeGoals: data?.orange?.stats?.core?.goals ?? 0,
      players,
    };
  }
}
