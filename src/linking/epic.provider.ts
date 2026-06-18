import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';

const AUTHORIZE_URL = 'https://www.epicgames.com/id/authorize';
const TOKEN_URL = 'https://api.epicgames.dev/epic/oauth/v1/token';
const ACCOUNTS_URL = 'https://api.epicgames.dev/epic/id/v2/accounts';

/**
 * Epic Account Services (EOS) — OAuth 2.0 / OpenID Connect, flujo authorization
 * code. Requiere registrar un producto + aplicación en el portal de Epic
 * (https://dev.epicgames.com/portal) para obtener client_id y client_secret, y
 * configurar el redirect URI exacto del callback. El token devuelve el
 * `account_id` (Epic Account ID), que es el ID que aparece en los replays.
 */
@Injectable()
export class EpicProvider {
  private clientId() {
    const id = process.env.EPIC_CLIENT_ID;
    if (!id) {
      throw new InternalServerErrorException(
        'EPIC_CLIENT_ID no está configurado',
      );
    }
    return id;
  }

  private basicAuth() {
    const id = this.clientId();
    const secret = process.env.EPIC_CLIENT_SECRET;
    if (!secret) {
      throw new InternalServerErrorException(
        'EPIC_CLIENT_SECRET no está configurado',
      );
    }
    return Buffer.from(`${id}:${secret}`).toString('base64');
  }

  /** URL a la que redirigir al usuario para "Iniciar sesión con Epic Games". */
  buildAuthUrl(state: string, redirectUri: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId(),
      response_type: 'code',
      scope: 'basic_profile',
      redirect_uri: redirectUri,
      state,
    });
    return `${AUTHORIZE_URL}?${params.toString()}`;
  }

  /**
   * Intercambia el código de autorización por un token y devuelve el
   * `account_id` (Epic Account ID) más el nombre visible (best-effort).
   */
  async exchangeCode(
    code: string,
    redirectUri: string,
  ): Promise<{ accountId: string; displayName: string | null }> {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      scope: 'basic_profile',
    });

    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${this.basicAuth()}`,
      },
      body: body.toString(),
    });

    if (!res.ok) {
      throw new BadRequestException('La verificación con Epic falló');
    }

    const token: any = await res.json();
    const accountId: string | undefined = token?.account_id;
    const accessToken: string | undefined = token?.access_token;
    if (!accountId) {
      throw new BadRequestException('Epic no devolvió un account_id');
    }

    const displayName = accessToken
      ? await this.fetchDisplayName(accountId, accessToken)
      : null;
    return { accountId, displayName };
  }

  /** Nombre visible de la cuenta Epic (best-effort). */
  private async fetchDisplayName(
    accountId: string,
    accessToken: string,
  ): Promise<string | null> {
    try {
      const url = `${ACCOUNTS_URL}?accountId=${accountId}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) return null;
      const data: any = await res.json();
      const account = Array.isArray(data) ? data[0] : data;
      return account?.displayName ?? null;
    } catch {
      return null;
    }
  }
}
