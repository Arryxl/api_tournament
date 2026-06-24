import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import {
  LinkedAccount,
  PlayerStat,
  PresetTeam,
  RegistrationForm,
  Team,
  TeamDraft,
  TeamMember,
  TournamentSettings,
  User,
} from '../entities';
import {
  LinkedPlatform,
  NotificationType,
  PlayerRank,
  RegistrationStatus,
  TeamDraftStatus,
  TeamStatus,
  UserRole,
} from '../common/enums';
import { NotificationsService } from '../notifications/notifications.service';
import { slugify } from './preset-teams';

@Injectable()
export class TeamsService {
  constructor(
    @InjectRepository(Team) private readonly teams: Repository<Team>,
    @InjectRepository(TeamMember)
    private readonly members: Repository<TeamMember>,
    @InjectRepository(RegistrationForm)
    private readonly forms: Repository<RegistrationForm>,
    @InjectRepository(TeamDraft)
    private readonly drafts: Repository<TeamDraft>,
    @InjectRepository(PresetTeam)
    private readonly presets: Repository<PresetTeam>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(PlayerStat) private readonly stats: Repository<PlayerStat>,
    @InjectRepository(TournamentSettings)
    private readonly settings: Repository<TournamentSettings>,
    private readonly dataSource: DataSource,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Regla GC1: solo se permite UN "Grand Champion 1" (gc1) por equipo.
   * Lanza si una lista de rangos contiene más de uno.
   */
  private assertSingleGc1(ranks: (string | null | undefined)[]) {
    const count = ranks.filter((r) => r === PlayerRank.GC1).length;
    if (count > 1) {
      throw new BadRequestException(
        'Solo se permite 1 Grand Champion 1 (GC1) por equipo. Revisa los rangos de los jugadores.',
      );
    }
  }

  /**
   * Verifica que añadir/editar un jugador con `newRank` no supere el límite de
   * 1 gc1 en el equipo `teamId` (excluye opcionalmente al miembro que se edita).
   */
  private async assertGc1Capacity(
    teamId: string,
    newRank: string | null | undefined,
    excludeMemberId?: string,
  ) {
    if (newRank !== PlayerRank.GC1) return;
    const members = await this.members.find({ where: { teamId } });
    const existing = members.filter(
      (m) => m.rank === PlayerRank.GC1 && m.id !== excludeMemberId,
    ).length;
    if (existing >= 1) {
      throw new BadRequestException(
        'El equipo ya tiene un Grand Champion 1 (GC1). Solo se permite uno por equipo.',
      );
    }
  }

  /** Notifica a todos los miembros del equipo con cuenta. */
  private async notifyTeam(
    teamId: string,
    type: NotificationType,
    title: string,
    link = '/me',
    body?: string,
  ) {
    const list = await this.members.find({ where: { teamId } });
    for (const m of list) {
      if (m.userId) {
        await this.notifications.notify(m.userId, type, title, link, body);
      }
    }
  }

  /** Quita el hash de contraseña del usuario embebido en cada miembro. */
  private sanitize(team: Team): Team {
    team.members?.forEach((m) => {
      if (m.user) delete (m.user as Partial<User>).passwordHash;
    });
    return team;
  }

  async findAll() {
    const list = await this.teams.find({
      relations: { members: { user: true }, group: true },
      order: { createdAt: 'DESC' },
    });
    return list.map((t) => this.sanitize(t));
  }

  async findOne(id: string) {
    const team = await this.teams.findOne({
      where: { id },
      relations: { members: { user: true }, group: true, captain: true },
    });
    if (!team) throw new NotFoundException('Equipo no encontrado');
    return this.sanitize(team);
  }

  /** Conteo de equipos aprobados/pendientes y el cupo configurado. */
  async count() {
    const [approved, pending] = await Promise.all([
      this.teams.count({ where: { status: TeamStatus.APPROVED } }),
      this.teams.count({ where: { status: TeamStatus.PENDING } }),
    ]);
    const settings = await this.settings.findOne({
      where: {},
      order: { updatedAt: 'DESC' },
    });
    return { approved, pending, capacity: settings?.teamCapacity ?? 16 };
  }

  /** Equipo al que pertenece el usuario autenticado (por su membresía). */
  async myTeam(userId: string) {
    const member = await this.members.findOne({ where: { userId } });
    if (!member) return null;
    return this.findOne(member.teamId);
  }

  // -------- Equipos predefinidos (catálogo) --------

  /** ¿Está activo el modo de equipos predefinidos? */
  private async predefinedMode(): Promise<boolean> {
    const settings = await this.settings.findOne({
      where: {},
      order: { updatedAt: 'DESC' },
    });
    return !!settings?.predefinedTeamsMode;
  }

  /**
   * Nombres ya reclamados (en minúsculas): equipos existentes + inscripciones
   * pendientes + drafts de reclutamiento pendientes. Sirve para reservar un
   * preset apenas alguien lo elige y envía, por cualquiera de los dos caminos.
   */
  private async takenTeamNames(): Promise<Set<string>> {
    const [teams, forms, drafts] = await Promise.all([
      this.teams.find({ select: { name: true } }),
      this.forms.find({
        where: { status: RegistrationStatus.PENDING },
        select: { teamName: true },
      }),
      this.drafts.find({
        where: { status: TeamDraftStatus.PENDING },
        select: { teamName: true },
      }),
    ]);
    const set = new Set<string>();
    teams.forEach((t) => t.name && set.add(t.name.toLowerCase()));
    forms.forEach((f) => f.teamName && set.add(f.teamName.toLowerCase()));
    drafts.forEach((d) => d.teamName && set.add(d.teamName.toLowerCase()));
    return set;
  }

  /** Busca un preset en la BD por slug o por nombre (case-insensitive). */
  private async findPreset(
    nameOrSlug: string | null | undefined,
  ): Promise<PresetTeam | null> {
    if (!nameOrSlug) return null;
    const key = nameOrSlug.trim().toLowerCase();
    const all = await this.presets.find();
    return (
      all.find(
        (p) => p.slug.toLowerCase() === key || p.name.toLowerCase() === key,
      ) ?? null
    );
  }

  /** Catálogo de presets (desde la BD) con su disponibilidad. */
  async listPresets() {
    const [all, taken] = await Promise.all([
      this.presets.find({ order: { sortOrder: 'ASC', name: 'ASC' } }),
      this.takenTeamNames(),
    ]);
    return all.map((p) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      region: p.region,
      placementLabel: p.placementLabel,
      logo: p.logo,
      sortOrder: p.sortOrder,
      taken: taken.has(p.name.toLowerCase()),
    }));
  }

  /**
   * Resuelve la selección de un preset para los flujos de CREACIÓN (inscripción
   * pública / draft de reclutamiento). Si el modo predefinido está inactivo
   * devuelve null (el llamador sigue con el flujo de nombre libre). Si está
   * activo, exige que `nameOrSlug` sea un preset disponible y devuelve sus datos
   * canónicos (nombre + escudo del catálogo) para fijarlos en el servidor.
   */
  async resolvePresetForCreate(
    nameOrSlug: string | null | undefined,
  ): Promise<{ name: string; shieldUrl: string | null } | null> {
    if (!(await this.predefinedMode())) return null;
    const preset = await this.findPreset(nameOrSlug);
    if (!preset) {
      throw new BadRequestException('Debes elegir un equipo del catálogo.');
    }
    const taken = await this.takenTeamNames();
    if (taken.has(preset.name.toLowerCase())) {
      throw new BadRequestException('Ese equipo ya fue tomado. Elige otro.');
    }
    return { name: preset.name, shieldUrl: preset.logo };
  }

  /**
   * Datos canónicos de un preset SIN comprobar disponibilidad (el nombre ya
   * quedó reservado al crear el draft). Usado al postular un draft completado:
   * normaliza el escudo desde el catálogo. Null si el modo está inactivo o el
   * nombre no es un preset.
   */
  private async presetDataIfActive(
    nameOrSlug: string | null | undefined,
  ): Promise<{ name: string; shieldUrl: string | null } | null> {
    if (!(await this.predefinedMode())) return null;
    const preset = await this.findPreset(nameOrSlug);
    return preset ? { name: preset.name, shieldUrl: preset.logo } : null;
  }

  // -------- CRUD del catálogo (admin) --------

  /** Genera un slug único a partir del nombre (sufijo numérico si colisiona). */
  private async uniqueSlug(name: string): Promise<string> {
    const base = slugify(name) || 'equipo';
    let slug = base;
    let n = 2;
    while (await this.presets.findOne({ where: { slug } })) {
      slug = `${base}-${n++}`;
    }
    return slug;
  }

  async createPreset(data: {
    name: string;
    region?: string | null;
    placementLabel?: string | null;
    logo?: string | null;
  }) {
    const name = data.name?.trim();
    if (!name) throw new BadRequestException('El nombre es obligatorio');
    const max = await this.presets
      .createQueryBuilder('p')
      .select('MAX(p.sortOrder)', 'max')
      .getRawOne<{ max: number | null }>();
    const preset = this.presets.create({
      slug: await this.uniqueSlug(name),
      name,
      region: data.region?.trim() || null,
      placementLabel: data.placementLabel?.trim() || null,
      logo: data.logo?.trim() || null,
      sortOrder: (max?.max ?? -1) + 1,
    });
    return this.presets.save(preset);
  }

  async updatePreset(
    id: string,
    data: {
      name?: string;
      region?: string | null;
      placementLabel?: string | null;
      logo?: string | null;
      sortOrder?: number;
    },
  ) {
    const preset = await this.presets.findOne({ where: { id } });
    if (!preset) throw new NotFoundException('Equipo predefinido no encontrado');
    if (data.name !== undefined) {
      const name = data.name.trim();
      if (!name) throw new BadRequestException('El nombre no puede estar vacío');
      preset.name = name;
    }
    if (data.region !== undefined) preset.region = data.region?.trim() || null;
    if (data.placementLabel !== undefined)
      preset.placementLabel = data.placementLabel?.trim() || null;
    if (data.logo !== undefined) preset.logo = data.logo?.trim() || null;
    if (typeof data.sortOrder === 'number') preset.sortOrder = data.sortOrder;
    return this.presets.save(preset);
  }

  async deletePreset(id: string) {
    const preset = await this.presets.findOne({ where: { id } });
    if (!preset) throw new NotFoundException('Equipo predefinido no encontrado');
    const taken = await this.takenTeamNames();
    if (taken.has(preset.name.toLowerCase())) {
      throw new BadRequestException(
        'No se puede eliminar: este equipo ya fue tomado por una inscripción o equipo.',
      );
    }
    await this.presets.remove(preset);
    return { ok: true };
  }

  // -------- Inscripciones --------
  async register(data: Partial<RegistrationForm>) {
    if (!data.teamName) {
      throw new BadRequestException('El nombre del equipo es obligatorio');
    }
    // En modo predefinido el servidor es autoritativo: fija nombre + escudo
    // desde el catálogo y reserva el equipo. Si no, valida unicidad como antes.
    const preset = await this.resolvePresetForCreate(data.teamName);
    if (preset) {
      data.teamName = preset.name;
      data.shieldUrl = preset.shieldUrl;
    } else {
      const existing = await this.teams.findOne({
        where: { name: data.teamName },
      });
      if (existing) {
        throw new BadRequestException('Ya existe un equipo con ese nombre');
      }
    }
    // Máximo 1 Grand Champion 1 por equipo.
    this.assertSingleGc1(
      [1, 2, 3, 4, 5].map((n) => (data as any)[`player${n}Rank`]),
    );
    const form = this.forms.create({
      ...data,
      status: RegistrationStatus.PENDING,
    });
    await this.forms.save(form);
    return { ok: true, id: form.id };
  }

  listRegistrations(status?: RegistrationStatus) {
    return this.forms.find({
      where: status ? { status } : {},
      order: { submittedAt: 'DESC' },
    });
  }

  async getRegistration(id: string) {
    const form = await this.forms.findOne({ where: { id } });
    if (!form) throw new NotFoundException('Inscripción no encontrada');
    return form;
  }

  /**
   * Aprueba una inscripción: crea el equipo, sus 3 jugadores como usuarios
   * candidato y los team_members. Devuelve las credenciales generadas.
   */
  async approveRegistration(
    formId: string,
    reviewerId: string,
    credentials?: { username: string; password: string }[],
  ) {
    const form = await this.getRegistration(formId);
    if (form.status === RegistrationStatus.APPROVED) {
      throw new BadRequestException('La inscripción ya fue aprobada');
    }
    // Re-valida la regla de 1 GC1 por equipo antes de crear el equipo.
    this.assertSingleGc1(
      [1, 2, 3, 4, 5].map((n) => (form as any)[`player${n}Rank`]),
    );

    return this.dataSource.transaction(async (manager) => {
      const team = manager.create(Team, {
        name: form.teamName,
        shieldUrl: form.shieldUrl,
        status: TeamStatus.APPROVED,
        contactMethod: form.contactMethod,
        contactValue: form.contactValue,
      });
      await manager.save(team);

      // Titulares (1–3) + suplentes (4–5). Se conserva el número original
      // de cada jugador (clave para capitán, suplencia y unicidad).
      const players = [1, 2, 3, 4, 5]
        .map((n) => ({
          num: n,
          epic: (form as any)[`player${n}Epic`] as string | null,
          steam: (form as any)[`player${n}Steam`] as string | null,
          psn: (form as any)[`player${n}Psn`] as string | null,
          xbox: (form as any)[`player${n}Xbox`] as string | null,
          switch: (form as any)[`player${n}Switch`] as string | null,
          rank: (form as any)[`player${n}Rank`] as string | null,
          shot: (form as any)[`player${n}Screenshot`] as string | null,
          userId: (form as any)[`player${n}UserId`] as string | null,
        }))
        .filter((p) => p.epic || p.steam || p.psn || p.xbox || p.switch || p.userId);

      const generated: { playerNumber: number; username: string; password: string }[] = [];
      let captainId: string | null = null;
      let credIndex = 0;

      for (const p of players) {
        const isCaptain = form.captainPlayer === p.num;
        let memberUserId: string;

        if (p.userId) {
          // Inscripción de reclutamiento: la cuenta ya existe → promover.
          await manager.update(User, { id: p.userId }, { role: UserRole.CANDIDATE });
          memberUserId = p.userId;
        } else {
          // Inscripción tradicional: crear la cuenta con credenciales.
          const cred = credentials?.[credIndex++];
          const baseName =
            (p.epic || p.steam || `${form.teamName}_p${p.num}`)
              .toLowerCase()
              .replace(/[^a-z0-9_]/g, '')
              .slice(0, 40) || `${form.teamName.toLowerCase()}p${p.num}`;
          const username = cred?.username || `${baseName}_${Math.random().toString(36).slice(2, 6)}`;
          const password = cred?.password || Math.random().toString(36).slice(2, 10);

          const user = manager.create(User, {
            username,
            passwordHash: await bcrypt.hash(password, 10),
            role: UserRole.CANDIDATE,
            coins: 0,
          });
          await manager.save(user);
          memberUserId = user.id;
          generated.push({ playerNumber: p.num, username, password });
        }

        if (isCaptain) captainId = memberUserId;

        const member = manager.create(TeamMember, {
          teamId: team.id,
          userId: memberUserId,
          epicUsername: p.epic,
          steamUsername: p.steam,
          psnUsername: p.psn,
          xboxUsername: p.xbox,
          switchUsername: p.switch,
          rank: (p.rank as PlayerRank) ?? null,
          screenshotUrl: p.shot,
          isCaptain,
          playerNumber: p.num,
        });
        await manager.save(member);

        // Pre-vincula los IDs de consola declarados (no verificados): el matcher
        // de replays los usa directamente. Steam/Epic se vinculan aparte por OAuth.
        const consoleLinks: [LinkedPlatform, string | null][] = [
          [LinkedPlatform.PSN, p.psn],
          [LinkedPlatform.XBOX, p.xbox],
          [LinkedPlatform.SWITCH, p.switch],
        ];
        for (const [platform, value] of consoleLinks) {
          const id = value?.trim();
          if (!id) continue;
          const taken = await manager.findOne(LinkedAccount, {
            where: { platform, platformId: id },
          });
          if (taken) continue; // ya reclamado por otro usuario → se omite
          await manager.save(
            manager.create(LinkedAccount, {
              userId: memberUserId,
              platform,
              platformId: id,
              displayName: id,
              verifiedAt: null,
            }),
          );
        }
      }

      if (captainId) {
        team.captainId = captainId;
        await manager.save(team);
      }

      form.status = RegistrationStatus.APPROVED;
      form.reviewedAt = new Date();
      form.reviewedBy = reviewerId;
      await manager.save(form);

      return { team, credentials: generated };
    }).then(async (res) => {
      // Avisar a los jugadores con cuenta (inscripciones de reclutamiento).
      await this.notifyTeam(
        res.team.id,
        NotificationType.TEAM_CREATED,
        `¡${res.team.name} fue inscrito al torneo!`,
        '/me',
      );
      return res;
    });
  }

  async rejectRegistration(formId: string, reviewerId: string, reason: string) {
    const form = await this.getRegistration(formId);
    form.status = RegistrationStatus.REJECTED;
    form.rejectionReason = reason;
    form.reviewedAt = new Date();
    form.reviewedBy = reviewerId;
    await this.forms.save(form);
    return { ok: true };
  }

  async update(id: string, data: Partial<Team>) {
    const team = await this.teams.findOne({ where: { id } });
    if (!team) throw new NotFoundException('Equipo no encontrado');
    Object.assign(team, data);
    await this.teams.save(team);
    return team;
  }

  // -------- Gestión de roster (admin) --------

  /**
   * Agrega un jugador a un equipo (p. ej. un reemplazo). Crea su usuario
   * candidato y devuelve las credenciales generadas.
   */
  async addMember(
    teamId: string,
    data: {
      epicUsername?: string;
      steamUsername?: string;
      psnUsername?: string;
      xboxUsername?: string;
      switchUsername?: string;
      rank?: string;
      screenshotUrl?: string;
      isCaptain?: boolean;
      username?: string;
      password?: string;
    },
  ) {
    const team = await this.teams.findOne({ where: { id: teamId } });
    if (!team) throw new NotFoundException('Equipo no encontrado');
    if (
      !data.epicUsername &&
      !data.steamUsername &&
      !data.psnUsername &&
      !data.xboxUsername &&
      !data.switchUsername
    ) {
      throw new BadRequestException(
        'El jugador necesita al menos un usuario (Epic, Steam, PSN, Xbox o Switch)',
      );
    }
    await this.assertGc1Capacity(teamId, data.rank);

    const existing = await this.members.find({ where: { teamId } });
    const nextNumber = existing.reduce((max, m) => Math.max(max, m.playerNumber), 0) + 1;

    return this.dataSource.transaction(async (manager) => {
      const base =
        (
          data.epicUsername ||
          data.steamUsername ||
          data.psnUsername ||
          data.xboxUsername ||
          data.switchUsername ||
          `${team.name}_p${nextNumber}`
        )
          .toLowerCase()
          .replace(/[^a-z0-9_]/g, '')
          .slice(0, 40) || `${team.name.toLowerCase()}p${nextNumber}`;
      const username = data.username || `${base}_${Math.random().toString(36).slice(2, 6)}`;
      const password = data.password || Math.random().toString(36).slice(2, 10);

      const user = manager.create(User, {
        username,
        passwordHash: await bcrypt.hash(password, 10),
        role: UserRole.CANDIDATE,
        coins: 0,
      });
      await manager.save(user);

      if (data.isCaptain) {
        await manager.update(TeamMember, { teamId }, { isCaptain: false });
      }

      const member = manager.create(TeamMember, {
        teamId,
        userId: user.id,
        epicUsername: data.epicUsername ?? null,
        steamUsername: data.steamUsername ?? null,
        psnUsername: data.psnUsername ?? null,
        xboxUsername: data.xboxUsername ?? null,
        switchUsername: data.switchUsername ?? null,
        rank: (data.rank as PlayerRank) ?? null,
        screenshotUrl: data.screenshotUrl ?? null,
        isCaptain: !!data.isCaptain,
        playerNumber: nextNumber,
      });
      await manager.save(member);

      // Pre-vincula los IDs de consola declarados (no verificados): el matcher
      // de replays los usa directamente. Steam/Epic se vinculan aparte por OAuth.
      const consoleLinks: [LinkedPlatform, string | null | undefined][] = [
        [LinkedPlatform.PSN, data.psnUsername],
        [LinkedPlatform.XBOX, data.xboxUsername],
        [LinkedPlatform.SWITCH, data.switchUsername],
      ];
      for (const [platform, value] of consoleLinks) {
        const id = value?.trim();
        if (!id) continue;
        const taken = await manager.findOne(LinkedAccount, {
          where: { platform, platformId: id },
        });
        if (taken) continue; // ya reclamado por otro usuario → se omite
        await manager.save(
          manager.create(LinkedAccount, {
            userId: user.id,
            platform,
            platformId: id,
            displayName: id,
            verifiedAt: null,
          }),
        );
      }

      if (data.isCaptain) {
        await manager.update(Team, { id: teamId }, { captainId: user.id });
      }

      return { member, credentials: { playerNumber: nextNumber, username, password } };
    });
  }

  /** Edita los datos de un miembro (Epic/Steam/rango/captura/capitán). */
  async updateMember(
    memberId: string,
    data: Partial<
      Pick<TeamMember, 'epicUsername' | 'steamUsername' | 'rank' | 'screenshotUrl' | 'isCaptain'>
    >,
  ) {
    const member = await this.members.findOne({ where: { id: memberId } });
    if (!member) throw new NotFoundException('Jugador no encontrado');
    if (data.rank !== undefined) {
      await this.assertGc1Capacity(member.teamId, data.rank, member.id);
    }
    if (data.isCaptain) {
      await this.members.update({ teamId: member.teamId }, { isCaptain: false });
      await this.teams.update({ id: member.teamId }, { captainId: member.userId });
    }
    Object.assign(member, data);
    await this.members.save(member);
    if (member.userId) {
      await this.notifications.notify(
        member.userId,
        NotificationType.MEMBER_LEFT,
        data.isCaptain
          ? 'Ahora eres el capitán de tu equipo'
          : 'El admin actualizó tus datos en el equipo',
        '/me',
      );
    }
    return member;
  }

  /** Revoca o restaura el acceso de un jugador (inhabilita su cuenta). */
  async setMemberAccess(memberId: string, active: boolean) {
    const member = await this.members.findOne({ where: { id: memberId } });
    if (!member) throw new NotFoundException('Jugador no encontrado');
    if (!member.userId) {
      throw new BadRequestException('Este jugador no tiene una cuenta asociada');
    }
    await this.users.update({ id: member.userId }, { isActive: active });
    await this.notifications.notify(
      member.userId,
      NotificationType.MEMBER_LEFT,
      active ? 'Tu acceso al torneo fue restaurado' : 'Tu acceso al torneo fue revocado',
      '/me',
    );
    return { ok: true, active };
  }

  /** Quita a un jugador del equipo y deshabilita su cuenta. */
  async removeMember(memberId: string) {
    const member = await this.members.findOne({ where: { id: memberId } });
    if (!member) throw new NotFoundException('Jugador no encontrado');
    if (member.userId) {
      await this.users.update({ id: member.userId }, { isActive: false });
      await this.notifications.notify(
        member.userId,
        NotificationType.MEMBER_LEFT,
        'Fuiste removido de tu equipo por el administrador',
        '/me',
      );
    }
    await this.members.delete({ id: memberId });
    return { ok: true };
  }

  // -------- Reclutamiento (reutilizado por RecruitmentService) --------

  /**
   * Cupo total del roster según la configuración del torneo
   * (titulares por lado + suplentes) y cuántas plazas quedan libres.
   */
  async rosterCapacity(teamId: string) {
    const settings = await this.settings.findOne({
      where: {},
      order: { updatedAt: 'DESC' },
    });
    const max = (settings?.playersPerSide ?? 3) + (settings?.substitutes ?? 2);
    const current = await this.members.count({ where: { teamId } });
    return { max, current, hasVacancy: current < max };
  }

  /**
   * Vincula una cuenta YA EXISTENTE como miembro del equipo (no crea usuario
   * ni credenciales, a diferencia de `addMember`). Promueve el rol del usuario
   * a `candidate`. Usado al aceptar una solicitud de reclutamiento.
   */
  async addExistingUserAsMember(
    teamId: string,
    userId: string,
    data: {
      epicUsername?: string | null;
      steamUsername?: string | null;
      rank?: string | null;
      screenshotUrl?: string | null;
    },
  ) {
    const team = await this.teams.findOne({ where: { id: teamId } });
    if (!team) throw new NotFoundException('Equipo no encontrado');

    const already = await this.members.findOne({ where: { userId } });
    if (already) {
      throw new BadRequestException('El jugador ya pertenece a un equipo');
    }

    const { hasVacancy } = await this.rosterCapacity(teamId);
    if (!hasVacancy) {
      throw new BadRequestException('El equipo ya completó su roster');
    }
    await this.assertGc1Capacity(teamId, data.rank);

    const existing = await this.members.find({ where: { teamId } });
    const nextNumber =
      existing.reduce((max, m) => Math.max(max, m.playerNumber), 0) + 1;

    return this.dataSource.transaction(async (manager) => {
      await manager.update(User, { id: userId }, { role: UserRole.CANDIDATE });

      const member = manager.create(TeamMember, {
        teamId,
        userId,
        epicUsername: data.epicUsername ?? null,
        steamUsername: data.steamUsername ?? null,
        rank: (data.rank as PlayerRank) ?? null,
        screenshotUrl: data.screenshotUrl ?? null,
        isCaptain: false,
        playerNumber: nextNumber,
      });
      await manager.save(member);
      return member;
    });
  }

  /**
   * Desvincula a un jugador del equipo MANTENIENDO su cuenta activa (a
   * diferencia de `removeMember`, que la deshabilita). Si el usuario no queda
   * en ningún otro equipo, baja su rol a `public`. Usado al aceptar una
   * solicitud de salida.
   */
  async detachMember(memberId: string) {
    const member = await this.members.findOne({ where: { id: memberId } });
    if (!member) throw new NotFoundException('Jugador no encontrado');
    const userId = member.userId;
    await this.members.delete({ id: memberId });
    if (userId) {
      const stillMember = await this.members.findOne({ where: { userId } });
      if (!stillMember) {
        await this.users.update({ id: userId }, { role: UserRole.PUBLIC });
      }
    }
    return { ok: true };
  }

  /**
   * Postula un equipo formado por reclutamiento como INSCRIPCIÓN pendiente
   * (`RegistrationForm`), NO como equipo. Pasa por el mismo flujo de aprobación
   * del admin que el registro tradicional; las cuentas de los jugadores ya
   * existen y quedan enlazadas vía `playerN_user_id` (al aprobar se promueven a
   * candidato sin generar credenciales). El primer miembro es el capitán.
   */
  async createRegistrationFromMembers(data: {
    name: string;
    shieldUrl?: string | null;
    contactMethod?: string | null;
    contactValue?: string | null;
    members: {
      userId: string;
      isCaptain?: boolean;
      epicUsername?: string | null;
      steamUsername?: string | null;
      rank?: string | null;
      screenshotUrl?: string | null;
    }[];
  }) {
    // En modo predefinido el equipo (nombre) ya quedó reservado al crear el
    // draft; aquí solo normalizamos nombre + escudo desde el catálogo. Si no,
    // valida unicidad contra los equipos existentes como antes.
    const preset = await this.presetDataIfActive(data.name);
    if (preset) {
      data.name = preset.name;
      data.shieldUrl = preset.shieldUrl;
    } else {
      const existingTeam = await this.teams.findOne({
        where: { name: data.name },
      });
      if (existingTeam) {
        throw new BadRequestException('Ya existe un equipo con ese nombre');
      }
    }
    // Máximo 1 Grand Champion 1 por equipo.
    this.assertSingleGc1(data.members.map((m) => m.rank));

    const form = this.forms.create({
      teamName: data.name,
      shieldUrl: data.shieldUrl ?? null,
      contactMethod: data.contactMethod ?? null,
      contactValue: data.contactValue ?? null,
      status: RegistrationStatus.PENDING,
    });
    data.members.slice(0, 5).forEach((m, i) => {
      const n = i + 1;
      (form as any)[`player${n}Epic`] = m.epicUsername ?? null;
      (form as any)[`player${n}Steam`] = m.steamUsername ?? null;
      (form as any)[`player${n}Rank`] = m.rank ?? null;
      (form as any)[`player${n}Screenshot`] = m.screenshotUrl ?? null;
      (form as any)[`player${n}UserId`] = m.userId;
      if (m.isCaptain) form.captainPlayer = n;
    });
    if (!form.captainPlayer) form.captainPlayer = 1;
    await this.forms.save(form);
    return form;
  }

  /**
   * Descarta un equipo liberando a sus jugadores (rol `public`, cuenta activa)
   * SIN notificar — uso interno para reparar equipos creados por versiones
   * anteriores antes de re-postularlos como inscripción.
   */
  async discardTeam(id: string) {
    const team = await this.teams.findOne({ where: { id } });
    if (!team) return { ok: true };
    const list = await this.members.find({ where: { teamId: id } });
    for (const m of list) {
      if (m.userId) {
        await this.users.update(
          { id: m.userId },
          { role: UserRole.PUBLIC, isActive: true },
        );
      }
    }
    await this.teams.delete({ id }); // cascade elimina los team_members
    return { ok: true };
  }

  /** Inscribe (aprueba) un equipo pendiente y avisa a sus jugadores. */
  async approveTeam(id: string) {
    const team = await this.teams.findOne({ where: { id } });
    if (!team) throw new NotFoundException('Equipo no encontrado');
    team.status = TeamStatus.APPROVED;
    await this.teams.save(team);
    await this.notifyTeam(
      team.id,
      NotificationType.TEAM_CREATED,
      `¡${team.name} fue inscrito al torneo!`,
      '/me',
    );
    return team;
  }

  /**
   * Saca un equipo del torneo (rechazo de inscripción o eliminación). Avisa a
   * los jugadores, los libera (rol `public`, cuenta activa) y borra el equipo.
   */
  async removeTeam(id: string, mode: 'rejected' | 'deleted') {
    const team = await this.teams.findOne({ where: { id } });
    if (!team) throw new NotFoundException('Equipo no encontrado');
    const title =
      mode === 'rejected'
        ? `${team.name} no fue inscrito al torneo`
        : `${team.name} fue eliminado del torneo`;
    await this.notifyTeam(team.id, NotificationType.REQUEST_REJECTED, title, '/me');
    const list = await this.members.find({ where: { teamId: team.id } });
    for (const m of list) {
      if (m.userId) {
        await this.users.update({ id: m.userId }, { role: UserRole.PUBLIC });
      }
    }
    await this.teams.delete({ id: team.id });
    return { ok: true };
  }

  async getStats(teamId: string) {
    const stats = await this.stats.find({ where: { teamId } });
    const totals = stats.reduce(
      (acc, s) => {
        acc.goals += s.goals;
        acc.assists += s.assists;
        acc.saves += s.saves;
        acc.score += s.score;
        return acc;
      },
      { goals: 0, assists: 0, saves: 0, score: 0 },
    );
    return { teamId, totals, entries: stats.length };
  }
}
