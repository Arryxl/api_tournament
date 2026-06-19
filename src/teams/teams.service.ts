import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import {
  PlayerStat,
  RegistrationForm,
  Team,
  TeamMember,
  TournamentSettings,
  User,
} from '../entities';
import {
  NotificationType,
  PlayerRank,
  RegistrationStatus,
  TeamStatus,
  UserRole,
} from '../common/enums';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class TeamsService {
  constructor(
    @InjectRepository(Team) private readonly teams: Repository<Team>,
    @InjectRepository(TeamMember)
    private readonly members: Repository<TeamMember>,
    @InjectRepository(RegistrationForm)
    private readonly forms: Repository<RegistrationForm>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(PlayerStat) private readonly stats: Repository<PlayerStat>,
    @InjectRepository(TournamentSettings)
    private readonly settings: Repository<TournamentSettings>,
    private readonly dataSource: DataSource,
    private readonly notifications: NotificationsService,
  ) {}

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

  // -------- Inscripciones --------
  async register(data: Partial<RegistrationForm>) {
    if (!data.teamName) {
      throw new BadRequestException('El nombre del equipo es obligatorio');
    }
    const existing = await this.teams.findOne({
      where: { name: data.teamName },
    });
    if (existing) {
      throw new BadRequestException('Ya existe un equipo con ese nombre');
    }
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
          rank: (form as any)[`player${n}Rank`] as string | null,
          shot: (form as any)[`player${n}Screenshot`] as string | null,
          userId: (form as any)[`player${n}UserId`] as string | null,
        }))
        .filter((p) => p.epic || p.steam || p.userId);

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
          rank: (p.rank as PlayerRank) ?? null,
          screenshotUrl: p.shot,
          isCaptain,
          playerNumber: p.num,
        });
        await manager.save(member);
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
      rank?: string;
      screenshotUrl?: string;
      isCaptain?: boolean;
      username?: string;
      password?: string;
    },
  ) {
    const team = await this.teams.findOne({ where: { id: teamId } });
    if (!team) throw new NotFoundException('Equipo no encontrado');
    if (!data.epicUsername && !data.steamUsername) {
      throw new BadRequestException('El jugador necesita al menos un usuario (Epic o Steam)');
    }

    const existing = await this.members.find({ where: { teamId } });
    const nextNumber = existing.reduce((max, m) => Math.max(max, m.playerNumber), 0) + 1;

    return this.dataSource.transaction(async (manager) => {
      const base =
        (data.epicUsername || data.steamUsername || `${team.name}_p${nextNumber}`)
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
        rank: (data.rank as PlayerRank) ?? null,
        screenshotUrl: data.screenshotUrl ?? null,
        isCaptain: !!data.isCaptain,
        playerNumber: nextNumber,
      });
      await manager.save(member);

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
    const existingTeam = await this.teams.findOne({ where: { name: data.name } });
    if (existingTeam) {
      throw new BadRequestException('Ya existe un equipo con ese nombre');
    }

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
