import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LinkedAccount, TeamMember } from '../entities';
import { LinkedPlatform } from '../common/enums';
import { SteamProvider } from './steam.provider';
import { EpicProvider } from './epic.provider';

interface LinkState {
  sub: string;
  platform: LinkedPlatform;
  purpose: 'link';
}

@Injectable()
export class LinkingService {
  constructor(
    @InjectRepository(LinkedAccount)
    private readonly links: Repository<LinkedAccount>,
    @InjectRepository(TeamMember)
    private readonly members: Repository<TeamMember>,
    private readonly jwt: JwtService,
    private readonly steam: SteamProvider,
    private readonly epic: EpicProvider,
  ) {}

  // ---- Configuración de URLs ------------------------------------------------

  private get apiBase() {
    return (process.env.PUBLIC_API_URL || 'http://localhost:3001').replace(
      /\/$/,
      '',
    );
  }

  private get frontBase() {
    return (process.env.FRONTEND_URL || 'http://localhost:5173').replace(
      /\/$/,
      '',
    );
  }

  private callbackUrl(platform: LinkedPlatform) {
    return `${this.apiBase}/api/link/${platform}/callback`;
  }

  /** URL del front a la que volver tras el callback (éxito o error). */
  resultRedirect(platform: LinkedPlatform, ok: boolean, reason?: string) {
    const params = new URLSearchParams({
      link: platform,
      status: ok ? 'ok' : 'error',
    });
    if (reason) params.set('reason', reason);
    return `${this.frontBase}/me?${params.toString()}`;
  }

  // ---- Estado firmado (CSRF + amarre al usuario) ---------------------------

  private createState(userId: string, platform: LinkedPlatform): string {
    return this.jwt.sign(
      { sub: userId, platform, purpose: 'link' } as LinkState,
      {
        secret: process.env.JWT_SECRET || 'gravity_secret_key_2025',
        expiresIn: '10m',
      } as any,
    );
  }

  private verifyState(token: string, platform: LinkedPlatform): string {
    let payload: LinkState;
    try {
      payload = this.jwt.verify(token, {
        secret: process.env.JWT_SECRET || 'gravity_secret_key_2025',
      });
    } catch {
      throw new BadRequestException('El enlace de vinculación expiró o es inválido');
    }
    if (payload.purpose !== 'link' || payload.platform !== platform) {
      throw new BadRequestException('Estado de vinculación inválido');
    }
    return payload.sub;
  }

  // ---- Inicio del flujo (devuelve la URL del proveedor) --------------------

  start(userId: string, platform: LinkedPlatform): { url: string } {
    const state = this.createState(userId, platform);
    if (platform === LinkedPlatform.STEAM) {
      const returnTo = `${this.callbackUrl(platform)}?state=${encodeURIComponent(state)}`;
      return { url: this.steam.buildAuthUrl(returnTo, this.apiBase) };
    }
    return {
      url: this.epic.buildAuthUrl(state, this.callbackUrl(platform)),
    };
  }

  // ---- Callbacks de los proveedores ----------------------------------------

  /** Steam adjunta sus parámetros openid.* y conserva nuestro `state`. */
  async handleSteamCallback(query: Record<string, string>): Promise<void> {
    const userId = this.verifyState(query.state, LinkedPlatform.STEAM);
    const steamId = await this.steam.verifyAssertion(query);
    const displayName = await this.steam.fetchDisplayName(steamId);
    await this.saveLink(userId, LinkedPlatform.STEAM, steamId, displayName);
  }

  /** Epic vuelve con `code` + `state`. */
  async handleEpicCallback(query: Record<string, string>): Promise<void> {
    if (!query.code) throw new BadRequestException('Epic no devolvió un código');
    const userId = this.verifyState(query.state, LinkedPlatform.EPIC);
    const { accountId, displayName } = await this.epic.exchangeCode(
      query.code,
      this.callbackUrl(LinkedPlatform.EPIC),
    );
    await this.saveLink(userId, LinkedPlatform.EPIC, accountId, displayName);
  }

  // ---- Persistencia --------------------------------------------------------

  private async saveLink(
    userId: string,
    platform: LinkedPlatform,
    platformId: string,
    displayName: string | null,
  ): Promise<LinkedAccount> {
    // La cuenta de plataforma no puede pertenecer ya a OTRO usuario.
    const owned = await this.links.findOne({ where: { platform, platformId } });
    if (owned && owned.userId !== userId) {
      throw new ConflictException(
        'Esa cuenta ya está vinculada a otro usuario del torneo',
      );
    }

    // Upsert por (userId, platform): re-vincular actualiza el ID y el nombre.
    const existing =
      owned ?? (await this.links.findOne({ where: { userId, platform } }));
    if (existing) {
      existing.platformId = platformId;
      existing.displayName = displayName;
      existing.verifiedAt = new Date();
      return this.links.save(existing);
    }
    return this.links.save(
      this.links.create({
        userId,
        platform,
        platformId,
        displayName,
        verifiedAt: new Date(),
      }),
    );
  }

  // ---- Consultas -----------------------------------------------------------

  forUser(userId: string) {
    return this.links.find({ where: { userId } });
  }

  async unlink(userId: string, platform: LinkedPlatform) {
    await this.links.delete({ userId, platform });
    return { ok: true };
  }

  /**
   * Estado de vinculación del usuario para el front: qué cuentas ya vinculó,
   * qué plataformas se esperan (según los nicks de su inscripción) y si está
   * completo. Para no-jugadores (sin team_member) no se espera ninguna.
   */
  async statusForUser(userId: string) {
    const accounts = await this.forUser(userId);
    const member = await this.members.findOne({ where: { userId } });
    const expected: LinkedPlatform[] = [];
    if (member?.steamUsername) expected.push(LinkedPlatform.STEAM);
    if (member?.epicUsername) expected.push(LinkedPlatform.EPIC);

    const linkedPlatforms = new Set(accounts.map((a) => a.platform));
    const complete = expected.every((p) => linkedPlatforms.has(p));

    return {
      accounts: accounts.map((a) => ({
        platform: a.platform,
        platformId: a.platformId,
        displayName: a.displayName,
        verifiedAt: a.verifiedAt,
      })),
      expected,
      isPlayer: !!member,
      complete,
    };
  }

  /**
   * [ADMIN] Estado de vinculación de un equipo: cada miembro con las
   * plataformas que se esperan y cuáles ya vinculó. `ready` indica si todos
   * los miembros completaron sus vinculaciones (gate "listo para jugar").
   */
  async teamReadiness(teamId: string) {
    const members = await this.members.find({
      where: { teamId },
      relations: { user: true },
    });
    const rows = await Promise.all(
      members.map(async (m) => {
        const expected: LinkedPlatform[] = [];
        if (m.steamUsername) expected.push(LinkedPlatform.STEAM);
        if (m.epicUsername) expected.push(LinkedPlatform.EPIC);
        const accounts = m.userId ? await this.forUser(m.userId) : [];
        const linked = new Set(accounts.map((a) => a.platform));
        const missing = expected.filter((p) => !linked.has(p));
        return {
          memberId: m.id,
          playerNumber: m.playerNumber,
          username: m.user?.username ?? m.epicUsername ?? m.steamUsername,
          expected,
          linked: [...linked],
          missing,
          ready: missing.length === 0,
        };
      }),
    );
    return { teamId, players: rows, ready: rows.every((r) => r.ready) };
  }

  /**
   * Resuelve un jugador de un replay a su cuenta vinculada (incluye el usuario
   * y su team_member). Punto de enganche para la ingesta de replays.
   */
  async resolveByPlatformId(platform: LinkedPlatform, platformId: string) {
    return this.links.findOne({
      where: { platform, platformId },
      relations: { user: true },
    });
  }
}
