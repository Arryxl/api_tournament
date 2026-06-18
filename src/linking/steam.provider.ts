import { BadRequestException, Injectable } from '@nestjs/common';

const STEAM_OPENID = 'https://steamcommunity.com/openid/login';
const NS = 'http://specs.openid.net/auth/2.0';
const IDENTIFIER_SELECT = `${NS}/identifier_select`;
const CLAIMED_ID_RE = /^https?:\/\/steamcommunity\.com\/openid\/id\/(\d{17})$/;

/**
 * Steam usa OpenID 2.0 (no OAuth). El flujo se implementa "stateless": se
 * redirige al usuario a Steam y, al volver, se verifica la aserción
 * reenviando los parámetros a Steam con `mode=check_authentication`. No hace
 * falta ninguna dependencia ni API key para autenticar; la API key solo se
 * usa para resolver el nombre visible del perfil.
 */
@Injectable()
export class SteamProvider {
  /**
   * URL a la que redirigir al usuario para iniciar sesión en Steam.
   * @param returnTo callback de la API (incluye el `state` firmado en su query)
   * @param realm dominio base (debe ser prefijo de `returnTo`)
   */
  buildAuthUrl(returnTo: string, realm: string): string {
    const params = new URLSearchParams({
      'openid.ns': NS,
      'openid.mode': 'checkid_setup',
      'openid.return_to': returnTo,
      'openid.realm': realm,
      'openid.identity': IDENTIFIER_SELECT,
      'openid.claimed_id': IDENTIFIER_SELECT,
    });
    return `${STEAM_OPENID}?${params.toString()}`;
  }

  /**
   * Verifica los parámetros que Steam adjuntó al callback y devuelve el
   * SteamID64. Lanza 400 si la aserción no es válida.
   */
  async verifyAssertion(query: Record<string, string>): Promise<string> {
    const claimedId = query['openid.claimed_id'];
    if (!claimedId) {
      throw new BadRequestException('Respuesta de Steam incompleta');
    }

    // Reenviar a Steam todos los parámetros openid.* cambiando el modo a
    // check_authentication para que confirme que la firma es auténtica.
    const body = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (key.startsWith('openid.')) body.append(key, value);
    }
    body.set('openid.mode', 'check_authentication');

    const res = await fetch(STEAM_OPENID, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    const text = await res.text();
    if (!/is_valid\s*:\s*true/i.test(text)) {
      throw new BadRequestException('La verificación con Steam falló');
    }

    const match = CLAIMED_ID_RE.exec(claimedId);
    if (!match) {
      throw new BadRequestException('SteamID inválido en la respuesta');
    }
    return match[1];
  }

  /** Nombre visible del perfil (best-effort; requiere STEAM_API_KEY). */
  async fetchDisplayName(steamId: string): Promise<string | null> {
    const key = process.env.STEAM_API_KEY;
    if (!key) return null;
    try {
      const url = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${key}&steamids=${steamId}`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const data: any = await res.json();
      return data?.response?.players?.[0]?.personaname ?? null;
    } catch {
      return null;
    }
  }
}
