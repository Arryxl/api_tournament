import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import {
  JoinRequest,
  PlayerProfile,
  RecruitmentPost,
  RegistrationForm,
  Team,
  TeamDraft,
  TeamDraftInvite,
  TeamMember,
  TeamLeaveRequest,
  TournamentSettings,
} from '../entities';
import {
  JoinDirection,
  NotificationType,
  RecruitmentStatus,
  RecruitmentType,
  RegistrationStatus,
  RequestStatus,
  TeamDraftStatus,
  TeamStatus,
} from '../common/enums';
import { TeamsService } from '../teams/teams.service';
import { NotificationsService } from '../notifications/notifications.service';

interface PostFilters {
  type?: RecruitmentType;
  rank?: string;
  position?: string;
  status?: RecruitmentStatus;
}

@Injectable()
export class RecruitmentService {
  constructor(
    @InjectRepository(RecruitmentPost)
    private readonly posts: Repository<RecruitmentPost>,
    @InjectRepository(JoinRequest)
    private readonly requests: Repository<JoinRequest>,
    @InjectRepository(TeamLeaveRequest)
    private readonly leaves: Repository<TeamLeaveRequest>,
    @InjectRepository(PlayerProfile)
    private readonly profiles: Repository<PlayerProfile>,
    @InjectRepository(TeamDraft)
    private readonly drafts: Repository<TeamDraft>,
    @InjectRepository(TeamDraftInvite)
    private readonly draftInvites: Repository<TeamDraftInvite>,
    @InjectRepository(RegistrationForm)
    private readonly forms: Repository<RegistrationForm>,
    @InjectRepository(Team) private readonly teams: Repository<Team>,
    @InjectRepository(TeamMember)
    private readonly members: Repository<TeamMember>,
    @InjectRepository(TournamentSettings)
    private readonly settings: Repository<TournamentSettings>,
    private readonly teamsService: TeamsService,
    private readonly notifications: NotificationsService,
  ) {}

  // -------- Helpers --------

  private async assertRegistrationsOpen() {
    const s = await this.settings.findOne({
      where: {},
      order: { updatedAt: 'DESC' },
    });
    if (s && !s.registrationsOpen) {
      throw new BadRequestException('Las inscripciones están cerradas');
    }
  }

  private async rosterTargets() {
    const s = await this.settings.findOne({
      where: {},
      order: { updatedAt: 'DESC' },
    });
    const requiredStarters = s?.playersPerSide ?? 3;
    const maxRoster = requiredStarters + (s?.substitutes ?? 2);
    return { requiredStarters, maxRoster };
  }

  private captainTeam(userId: string) {
    return this.teams.findOne({ where: { captainId: userId } });
  }

  private memberOf(userId: string) {
    return this.members.findOne({ where: { userId } });
  }

  private isProfileComplete(p: PlayerProfile | null): p is PlayerProfile {
    return !!(p && (p.epicUsername || p.steamUsername) && p.rank && p.screenshotUrl);
  }

  private async requireProfile(userId: string): Promise<PlayerProfile> {
    const p = await this.profiles.findOne({ where: { userId } });
    if (!this.isProfileComplete(p)) {
      throw new BadRequestException(
        'Completa tu perfil de jugador (usuario de Epic/Steam, rango y captura) antes de participar en el reclutamiento',
      );
    }
    return p;
  }

  /**
   * Estado de compromiso del usuario que lo inhabilita para iniciar nuevas
   * acciones de reclutamiento. NO bloquea por invitaciones pendientes sin
   * aceptar (puede recibir varias y elegir una).
   */
  private async committedReason(userId: string): Promise<string | null> {
    if (await this.memberOf(userId)) return 'en un equipo';
    const draftCap = await this.drafts.findOne({
      where: { captainId: userId, status: TeamDraftStatus.PENDING },
    });
    if (draftCap) return 'creando un equipo';
    const acceptedInvite = await this.draftInvites.findOne({
      where: { userId, status: RequestStatus.ACCEPTED },
      relations: { draft: true },
    });
    if (acceptedInvite && acceptedInvite.draft.status === TeamDraftStatus.PENDING) {
      return 'comprometido en un equipo en formación';
    }
    return null;
  }

  private async assertFree(userId: string) {
    const reason = await this.committedReason(userId);
    if (reason) throw new BadRequestException(`Ya estás ${reason}.`);
  }

  /**
   * Al comprometerse el jugador con un equipo, descarta sus demás ofertas
   * pendientes (postulaciones, invitaciones a equipos y a drafts) para que no
   * pueda quedar comprometido en dos sitios.
   */
  private async releasePendingOffers(
    userId: string,
    except: { joinId?: string; inviteId?: string } = {},
  ) {
    const jw: Record<string, unknown> = {
      applicantId: userId,
      status: RequestStatus.PENDING,
    };
    if (except.joinId) jw.id = Not(except.joinId);
    await this.requests.update(jw, {
      status: RequestStatus.REJECTED,
      resolvedAt: new Date(),
    });

    const iw: Record<string, unknown> = {
      userId,
      status: RequestStatus.PENDING,
    };
    if (except.inviteId) iw.id = Not(except.inviteId);
    await this.draftInvites.update(iw, { status: RequestStatus.REJECTED });
  }

  private async closePlayerPosts(userId: string) {
    await this.posts.update(
      {
        authorId: userId,
        type: RecruitmentType.PLAYER_LFT,
        status: RecruitmentStatus.OPEN,
      },
      { status: RecruitmentStatus.CLOSED },
    );
  }

  // -------- Perfil de jugador --------

  getProfile(userId: string) {
    return this.profiles.findOne({ where: { userId } });
  }

  async upsertProfile(
    userId: string,
    data: Partial<
      Pick<
        PlayerProfile,
        | 'epicUsername'
        | 'steamUsername'
        | 'rank'
        | 'screenshotUrl'
        | 'position'
        | 'region'
        | 'availability'
      >
    >,
  ) {
    let p = await this.profiles.findOne({ where: { userId } });
    if (!p) p = this.profiles.create({ userId });
    const fields = [
      'epicUsername',
      'steamUsername',
      'rank',
      'screenshotUrl',
      'position',
      'region',
      'availability',
    ] as const;
    for (const f of fields) {
      if (data[f] !== undefined) (p as any)[f] = data[f];
    }
    await this.profiles.save(p);
    return { ...p, complete: this.isProfileComplete(p) };
  }

  // -------- Vitrina --------

  list(filters: PostFilters) {
    const where: Record<string, unknown> = {
      status: filters.status ?? RecruitmentStatus.OPEN,
    };
    if (filters.type) where.type = filters.type;
    if (filters.rank) where.rank = filters.rank;
    if (filters.position) where.position = filters.position;
    return this.posts.find({
      where,
      relations: { author: true, team: true },
      order: { createdAt: 'DESC' },
    });
  }

  mine(userId: string) {
    return this.posts.find({
      where: { authorId: userId },
      relations: { team: true },
      order: { createdAt: 'DESC' },
    });
  }

  async createPost(
    userId: string,
    data: {
      type: RecruitmentType;
      message?: string;
      region?: string;
      availability?: string;
      teamName?: string;
      lookingForRank?: string;
      lookingForPosition?: string;
      slotsNeeded?: number;
    },
  ) {
    await this.assertRegistrationsOpen();

    const open = await this.posts.findOne({
      where: {
        authorId: userId,
        type: data.type,
        status: RecruitmentStatus.OPEN,
      },
    });
    if (open) {
      throw new BadRequestException(
        'Ya tienes un anuncio abierto de este tipo. Ciérralo antes de publicar otro.',
      );
    }

    const post = this.posts.create({
      type: data.type,
      authorId: userId,
      status: RecruitmentStatus.OPEN,
      message: data.message ?? null,
      region: data.region ?? null,
      availability: data.availability ?? null,
    });

    if (data.type === RecruitmentType.PLAYER_LFT) {
      await this.assertFree(userId);
      const profile = await this.requireProfile(userId);
      // Snapshot desde el perfil (fuente única de los datos de juego).
      post.epicUsername = profile.epicUsername;
      post.steamUsername = profile.steamUsername;
      post.rank = profile.rank;
      post.screenshotUrl = profile.screenshotUrl;
      post.position = profile.position;
      post.region = data.region ?? profile.region;
      post.availability = data.availability ?? profile.availability;
    } else {
      const team = await this.captainTeam(userId);
      if (team) {
        post.teamId = team.id;
        post.teamName = team.name;
      } else {
        if (!data.teamName) {
          throw new BadRequestException('Indica el nombre del equipo');
        }
        post.teamName = data.teamName;
      }
      post.lookingForRank = (data.lookingForRank as any) ?? null;
      post.lookingForPosition = (data.lookingForPosition as any) ?? null;
      post.slotsNeeded = data.slotsNeeded ?? 1;
    }

    await this.posts.save(post);
    return post;
  }

  private async ownedPost(id: string, userId: string, isAdmin: boolean) {
    const post = await this.posts.findOne({ where: { id } });
    if (!post) throw new NotFoundException('Anuncio no encontrado');
    if (!isAdmin && post.authorId !== userId) {
      throw new ForbiddenException('No puedes modificar este anuncio');
    }
    return post;
  }

  async updatePost(
    id: string,
    userId: string,
    isAdmin: boolean,
    data: Partial<RecruitmentPost>,
  ) {
    const post = await this.ownedPost(id, userId, isAdmin);
    const allowed: (keyof RecruitmentPost)[] = [
      'message',
      'region',
      'availability',
      'lookingForRank',
      'lookingForPosition',
      'slotsNeeded',
    ];
    for (const key of allowed) {
      if (data[key] !== undefined) (post as any)[key] = data[key];
    }
    if (
      data.status === RecruitmentStatus.OPEN ||
      data.status === RecruitmentStatus.CLOSED
    ) {
      post.status = data.status;
    }
    await this.posts.save(post);
    return post;
  }

  async deletePost(id: string, userId: string, isAdmin: boolean) {
    await this.ownedPost(id, userId, isAdmin);
    await this.posts.delete({ id });
    return { ok: true };
  }

  async moderatePost(id: string) {
    const post = await this.posts.findOne({ where: { id } });
    if (!post) throw new NotFoundException('Anuncio no encontrado');
    post.status = RecruitmentStatus.HIDDEN;
    await this.posts.save(post);
    return post;
  }

  // -------- Solicitudes de unión (equipos ya inscritos) --------

  async createRequest(
    userId: string,
    data: {
      teamId: string;
      direction: JoinDirection;
      applicantId?: string;
      sourcePostId?: string;
      message?: string;
    },
  ) {
    await this.assertRegistrationsOpen();

    const team = await this.teams.findOne({ where: { id: data.teamId } });
    if (!team) throw new NotFoundException('Equipo no encontrado');

    const { hasVacancy } = await this.teamsService.rosterCapacity(team.id);
    if (!hasVacancy) {
      throw new BadRequestException('El equipo ya completó su roster');
    }

    let applicantId: string;
    if (data.direction === JoinDirection.PLAYER_TO_TEAM) {
      applicantId = userId;
      if (team.captainId === userId) {
        throw new BadRequestException('No puedes postularte a tu propio equipo');
      }
      await this.assertFree(userId);
    } else {
      if (team.captainId !== userId) {
        throw new ForbiddenException('Solo el capitán puede invitar jugadores');
      }
      if (!data.applicantId) {
        throw new BadRequestException('Falta el jugador a invitar');
      }
      if (data.applicantId === userId) {
        throw new BadRequestException('No puedes invitarte a ti mismo');
      }
      applicantId = data.applicantId;
    }

    // Datos del jugador desde su perfil (fuente única).
    const profile = await this.requireProfile(applicantId);

    const inTeam = await this.memberOf(applicantId);
    if (inTeam) {
      throw new BadRequestException('El jugador ya pertenece a un equipo');
    }

    const dup = await this.requests.findOne({
      where: {
        teamId: team.id,
        applicantId,
        status: RequestStatus.PENDING,
      },
    });
    if (dup) {
      throw new BadRequestException(
        'Ya existe una solicitud pendiente para este jugador y equipo',
      );
    }

    const req = this.requests.create({
      teamId: team.id,
      direction: data.direction,
      status: RequestStatus.PENDING,
      sourcePostId: data.sourcePostId ?? null,
      message: data.message ?? null,
      applicantId,
      epicUsername: profile.epicUsername,
      steamUsername: profile.steamUsername,
      rank: profile.rank,
      screenshotUrl: profile.screenshotUrl,
    });
    await this.requests.save(req);

    if (data.direction === JoinDirection.PLAYER_TO_TEAM) {
      if (team.captainId) {
        await this.notifications.notify(
          team.captainId,
          NotificationType.APPLICATION,
          `Nueva postulación para ${team.name}`,
          '/mi-equipo',
        );
      }
    } else {
      await this.notifications.notify(
        applicantId,
        NotificationType.TEAM_INVITE,
        `${team.name} te invitó a unirte`,
        '/me',
      );
    }
    return req;
  }

  async incoming(userId: string) {
    const team = await this.captainTeam(userId);
    const asCaptain = team
      ? await this.requests.find({
          where: {
            teamId: team.id,
            direction: JoinDirection.PLAYER_TO_TEAM,
            status: RequestStatus.PENDING,
          },
          relations: { applicant: true, team: true },
          order: { createdAt: 'DESC' },
        })
      : [];
    const asPlayer = await this.requests.find({
      where: {
        applicantId: userId,
        direction: JoinDirection.TEAM_TO_PLAYER,
        status: RequestStatus.PENDING,
      },
      relations: { team: true },
      order: { createdAt: 'DESC' },
    });
    return [...asCaptain, ...asPlayer];
  }

  async outgoing(userId: string) {
    const team = await this.captainTeam(userId);
    const asCaptain = team
      ? await this.requests.find({
          where: { teamId: team.id, direction: JoinDirection.TEAM_TO_PLAYER },
          relations: { applicant: true, team: true },
          order: { createdAt: 'DESC' },
        })
      : [];
    const asPlayer = await this.requests.find({
      where: { applicantId: userId, direction: JoinDirection.PLAYER_TO_TEAM },
      relations: { team: true },
      order: { createdAt: 'DESC' },
    });
    return [...asCaptain, ...asPlayer];
  }

  private async loadRequest(id: string) {
    const req = await this.requests.findOne({
      where: { id },
      relations: { team: true },
    });
    if (!req) throw new NotFoundException('Solicitud no encontrada');
    return req;
  }

  private isReceiver(req: JoinRequest, userId: string) {
    return req.direction === JoinDirection.PLAYER_TO_TEAM
      ? req.team.captainId === userId
      : req.applicantId === userId;
  }

  async acceptRequest(id: string, userId: string) {
    const req = await this.loadRequest(id);
    if (req.status !== RequestStatus.PENDING) {
      throw new BadRequestException('La solicitud ya fue resuelta');
    }
    if (!this.isReceiver(req, userId)) {
      throw new ForbiddenException('No puedes resolver esta solicitud');
    }

    await this.teamsService.addExistingUserAsMember(req.teamId, req.applicantId, {
      epicUsername: req.epicUsername,
      steamUsername: req.steamUsername,
      rank: req.rank,
      screenshotUrl: req.screenshotUrl,
    });

    req.status = RequestStatus.ACCEPTED;
    req.resolvedAt = new Date();
    req.resolvedBy = userId;
    await this.requests.save(req);

    if (req.sourcePostId) {
      await this.posts.update(
        { id: req.sourcePostId },
        { status: RecruitmentStatus.CLOSED },
      );
    }
    await this.closePlayerPosts(req.applicantId);
    await this.releasePendingOffers(req.applicantId, { joinId: req.id });

    await this.notifications.notify(
      req.applicantId,
      NotificationType.REQUEST_ACCEPTED,
      `Te uniste a ${req.team.name}`,
      '/me',
    );
    return { ok: true };
  }

  async rejectRequest(id: string, userId: string) {
    const req = await this.loadRequest(id);
    if (req.status !== RequestStatus.PENDING) {
      throw new BadRequestException('La solicitud ya fue resuelta');
    }
    if (!this.isReceiver(req, userId)) {
      throw new ForbiddenException('No puedes resolver esta solicitud');
    }
    req.status = RequestStatus.REJECTED;
    req.resolvedAt = new Date();
    req.resolvedBy = userId;
    await this.requests.save(req);
    // Avisar al emisor.
    const emisor =
      req.direction === JoinDirection.PLAYER_TO_TEAM
        ? req.applicantId
        : req.team.captainId;
    if (emisor) {
      await this.notifications.notify(
        emisor,
        NotificationType.REQUEST_REJECTED,
        `Tu solicitud con ${req.team.name} fue rechazada`,
        '/me',
      );
    }
    return { ok: true };
  }

  async cancelRequest(id: string, userId: string) {
    const req = await this.loadRequest(id);
    if (req.status !== RequestStatus.PENDING) {
      throw new BadRequestException('La solicitud ya fue resuelta');
    }
    const isSender =
      req.direction === JoinDirection.PLAYER_TO_TEAM
        ? req.applicantId === userId
        : req.team.captainId === userId;
    if (!isSender) {
      throw new ForbiddenException('No puedes cancelar esta solicitud');
    }
    req.status = RequestStatus.CANCELLED;
    req.resolvedAt = new Date();
    await this.requests.save(req);
    return { ok: true };
  }

  // -------- Salida de equipo --------

  async requestLeave(userId: string, reason?: string) {
    const member = await this.memberOf(userId);
    if (!member) throw new BadRequestException('No perteneces a ningún equipo');

    const team = await this.teams.findOne({ where: { id: member.teamId } });
    if (team?.captainId === userId) {
      throw new BadRequestException(
        'Eres el capitán: transfiere la capitanía antes de salir del equipo',
      );
    }

    const dup = await this.leaves.findOne({
      where: { memberId: member.id, status: RequestStatus.PENDING },
    });
    if (dup) {
      throw new BadRequestException('Ya tienes una solicitud de salida pendiente');
    }

    const leave = this.leaves.create({
      memberId: member.id,
      teamId: member.teamId,
      userId,
      status: RequestStatus.PENDING,
      reason: reason ?? null,
    });
    await this.leaves.save(leave);

    if (team?.captainId) {
      await this.notifications.notify(
        team.captainId,
        NotificationType.LEAVE_REQUEST,
        `Un jugador quiere salir de ${team.name}`,
        '/mi-equipo',
      );
    }
    return leave;
  }

  async leaveIncoming(userId: string) {
    const team = await this.captainTeam(userId);
    if (!team) return [];
    return this.leaves.find({
      where: { teamId: team.id, status: RequestStatus.PENDING },
      relations: { user: true, member: true },
      order: { createdAt: 'DESC' },
    });
  }

  private async loadLeave(id: string, userId: string) {
    const leave = await this.leaves.findOne({
      where: { id },
      relations: { team: true },
    });
    if (!leave) throw new NotFoundException('Solicitud no encontrada');
    if (leave.team.captainId !== userId) {
      throw new ForbiddenException('Solo el capitán puede resolver esta salida');
    }
    if (leave.status !== RequestStatus.PENDING) {
      throw new BadRequestException('La solicitud ya fue resuelta');
    }
    return leave;
  }

  async acceptLeave(id: string, userId: string) {
    const leave = await this.loadLeave(id, userId);
    await this.teamsService.detachMember(leave.memberId);
    leave.status = RequestStatus.ACCEPTED;
    leave.resolvedAt = new Date();
    await this.leaves.save(leave);
    await this.notifications.notify(
      leave.userId,
      NotificationType.MEMBER_LEFT,
      'Tu salida del equipo fue aceptada',
      '/me',
    );
    return { ok: true };
  }

  async rejectLeave(id: string, userId: string) {
    const leave = await this.loadLeave(id, userId);
    leave.status = RequestStatus.REJECTED;
    leave.resolvedAt = new Date();
    await this.leaves.save(leave);
    await this.notifications.notify(
      leave.userId,
      NotificationType.REQUEST_REJECTED,
      'Tu solicitud de salida fue rechazada',
      '/me',
    );
    return { ok: true };
  }

  // -------- Creación de equipo por invitaciones (drafts) --------

  async createDraft(
    userId: string,
    data: {
      teamName: string;
      shieldUrl?: string;
      contactMethod?: string;
      contactValue?: string;
      inviteUserIds: string[];
    },
  ) {
    await this.assertRegistrationsOpen();
    await this.requireProfile(userId);
    await this.assertFree(userId);

    if (!data.teamName?.trim()) {
      throw new BadRequestException('Ponle un nombre al equipo');
    }
    if (!data.contactValue?.trim()) {
      throw new BadRequestException(
        'Indica un medio de contacto del capitán para la inscripción',
      );
    }
    const existing = await this.teams.findOne({ where: { name: data.teamName } });
    if (existing) {
      throw new BadRequestException('Ya existe un equipo con ese nombre');
    }

    const { requiredStarters, maxRoster } = await this.rosterTargets();
    const invitees = [...new Set(data.inviteUserIds || [])].filter(
      (id) => id !== userId,
    );
    if (invitees.length < requiredStarters - 1) {
      throw new BadRequestException(
        `Debes invitar al menos a ${requiredStarters - 1} jugador(es) para completar los titulares`,
      );
    }
    if (invitees.length > maxRoster - 1) {
      throw new BadRequestException(
        `Demasiados invitados: el roster admite hasta ${maxRoster} jugadores`,
      );
    }

    // Cada invitado debe tener ficha abierta en el tablón, perfil completo y no estar en equipo.
    for (const inviteeId of invitees) {
      const ficha = await this.posts.findOne({
        where: {
          authorId: inviteeId,
          type: RecruitmentType.PLAYER_LFT,
          status: RecruitmentStatus.OPEN,
        },
      });
      if (!ficha) {
        throw new BadRequestException(
          'Solo puedes invitar a jugadores con ficha publicada en el tablón',
        );
      }
      const profile = await this.profiles.findOne({ where: { userId: inviteeId } });
      if (!this.isProfileComplete(profile)) {
        throw new BadRequestException('Un jugador invitado no tiene el perfil completo');
      }
      if (await this.memberOf(inviteeId)) {
        throw new BadRequestException('Un jugador invitado ya pertenece a un equipo');
      }
    }

    const draft = this.drafts.create({
      captainId: userId,
      teamName: data.teamName.trim(),
      shieldUrl: data.shieldUrl ?? null,
      contactMethod: data.contactMethod ?? 'discord',
      contactValue: data.contactValue.trim(),
      requiredStarters,
      maxRoster,
      status: TeamDraftStatus.PENDING,
    });
    await this.drafts.save(draft);

    for (const inviteeId of invitees) {
      const invite = this.draftInvites.create({
        draftId: draft.id,
        userId: inviteeId,
        status: RequestStatus.PENDING,
      });
      await this.draftInvites.save(invite);
      await this.notifications.notify(
        inviteeId,
        NotificationType.DRAFT_INVITE,
        `Te invitaron a formar el equipo ${draft.teamName}`,
        '/me',
      );
    }
    return draft;
  }

  async draftsMine(userId: string) {
    const asCaptain = await this.drafts.findOne({
      where: { captainId: userId, status: TeamDraftStatus.PENDING },
      relations: { invites: { user: true } },
    });
    const asInvited = await this.draftInvites.find({
      where: { userId, status: RequestStatus.PENDING },
      relations: { draft: { captain: true } },
      order: { createdAt: 'DESC' },
    });
    // Equipo en formación al que ya acepté unirme (sigo esperando a los demás).
    const accepted = await this.draftInvites.findOne({
      where: { userId, status: RequestStatus.ACCEPTED },
      relations: { draft: { invites: true, captain: true } },
      order: { acceptedAt: 'DESC' },
    });
    const committedDraft =
      accepted && accepted.draft.status === TeamDraftStatus.PENDING
        ? accepted.draft
        : null;

    // Inscripción postulada en espera de aprobación del admin: drafts COMPLETED
    // (como capitán o invitado aceptado) cuya RegistrationForm sigue PENDING.
    const myDrafts = await this.drafts.find({
      where: { status: TeamDraftStatus.COMPLETED },
      relations: { invites: true },
    });
    let pendingRegistration: { teamName: string; submittedAt: Date } | null = null;
    for (const d of myDrafts) {
      const involved =
        d.captainId === userId ||
        d.invites?.some(
          (i) => i.userId === userId && i.status === RequestStatus.ACCEPTED,
        );
      if (!involved || !d.registrationId) continue;
      const form = await this.forms.findOne({ where: { id: d.registrationId } });
      if (form && form.status === RegistrationStatus.PENDING) {
        pendingRegistration = { teamName: d.teamName, submittedAt: form.submittedAt };
        break;
      }
    }

    return {
      asCaptain: asCaptain ?? null,
      asInvited,
      committedDraft,
      pendingRegistration,
    };
  }

  private async profileSnapshot(userId: string) {
    const p = await this.requireProfile(userId);
    return {
      epicUsername: p.epicUsername,
      steamUsername: p.steamUsername,
      rank: p.rank,
      screenshotUrl: p.screenshotUrl,
    };
  }

  async acceptDraftInvite(inviteId: string, userId: string) {
    const invite = await this.draftInvites.findOne({
      where: { id: inviteId },
      relations: { draft: true },
    });
    if (!invite) throw new NotFoundException('Invitación no encontrada');
    if (invite.userId !== userId) {
      throw new ForbiddenException('Esta invitación no es tuya');
    }
    if (invite.status !== RequestStatus.PENDING) {
      throw new BadRequestException('La invitación ya fue resuelta');
    }
    const draft = invite.draft;
    if (draft.status !== TeamDraftStatus.PENDING) {
      throw new BadRequestException('Este equipo ya no está en formación');
    }
    if (await this.memberOf(userId)) {
      throw new BadRequestException('Ya perteneces a un equipo');
    }
    await this.requireProfile(userId);

    invite.status = RequestStatus.ACCEPTED;
    invite.acceptedAt = new Date();
    await this.draftInvites.save(invite);
    await this.releasePendingOffers(userId, { inviteId });

    const accepted = await this.draftInvites.find({
      where: { draftId: draft.id, status: RequestStatus.ACCEPTED },
      order: { acceptedAt: 'ASC' },
    });
    const total = 1 + accepted.length; // capitán + invitados aceptados

    if (total >= draft.requiredStarters) {
      // Equipo completo: se POSTULA como inscripción (no se crea el equipo aún).
      // Capitán + primeros (requiredStarters - 1) por orden de aceptación.
      const starterInvites = accepted.slice(0, draft.requiredStarters - 1);
      const members: {
        userId: string;
        isCaptain?: boolean;
        epicUsername?: string | null;
        steamUsername?: string | null;
        rank?: string | null;
        screenshotUrl?: string | null;
      }[] = [{ userId: draft.captainId, isCaptain: true, ...(await this.profileSnapshot(draft.captainId)) }];
      for (const si of starterInvites) {
        members.push({ userId: si.userId, ...(await this.profileSnapshot(si.userId)) });
      }

      const form = await this.teamsService.createRegistrationFromMembers({
        name: draft.teamName,
        shieldUrl: draft.shieldUrl,
        contactMethod: draft.contactMethod,
        contactValue: draft.contactValue,
        members,
      });

      draft.status = TeamDraftStatus.COMPLETED;
      draft.registrationId = form.id;
      draft.completedAt = new Date();
      await this.drafts.save(draft);

      // Cancelar las invitaciones que sigan pendientes (el equipo ya se postuló).
      await this.draftInvites.update(
        { draftId: draft.id, status: RequestStatus.PENDING },
        { status: RequestStatus.CANCELLED },
      );

      // Cerrar fichas y avisar a los miembros postulados.
      for (const m of members) {
        await this.closePlayerPosts(m.userId);
        await this.notifications.notify(
          m.userId,
          NotificationType.TEAM_CREATED,
          `${draft.teamName} quedó postulado a inscripción`,
          '/me',
          'El equipo está completo y a la espera de que el administrador apruebe su inscripción al torneo. Te avisaremos cuando se resuelva.',
        );
      }
      return { ok: true, status: 'submitted', teamName: draft.teamName };
    }

    const remaining = Math.max(0, draft.requiredStarters - total);
    return {
      ok: true,
      status: 'waiting',
      remaining,
      accepted: total,
      requiredStarters: draft.requiredStarters,
    };
  }

  async rejectDraftInvite(inviteId: string, userId: string) {
    const invite = await this.draftInvites.findOne({ where: { id: inviteId } });
    if (!invite) throw new NotFoundException('Invitación no encontrada');
    if (invite.userId !== userId) {
      throw new ForbiddenException('Esta invitación no es tuya');
    }
    if (invite.status !== RequestStatus.PENDING) {
      throw new BadRequestException('La invitación ya fue resuelta');
    }
    invite.status = RequestStatus.REJECTED;
    await this.draftInvites.save(invite);
    return { ok: true };
  }

  async cancelDraft(id: string, userId: string) {
    const draft = await this.drafts.findOne({ where: { id } });
    if (!draft) throw new NotFoundException('Equipo en formación no encontrado');
    if (draft.captainId !== userId) {
      throw new ForbiddenException('Solo el capitán puede cancelar');
    }
    if (draft.status !== TeamDraftStatus.PENDING) {
      throw new BadRequestException('Este equipo ya no está en formación');
    }
    draft.status = TeamDraftStatus.CANCELLED;
    await this.drafts.save(draft);
    await this.draftInvites.update(
      { draftId: draft.id, status: RequestStatus.PENDING },
      { status: RequestStatus.CANCELLED },
    );
    return { ok: true };
  }

  // -------- Admin --------

  listAllRequests() {
    return this.requests.find({
      relations: { applicant: true, team: true },
      order: { createdAt: 'DESC' },
    });
  }

  listAllPosts() {
    return this.posts.find({
      relations: { author: true, team: true },
      order: { createdAt: 'DESC' },
    });
  }

  listAllDrafts() {
    return this.drafts.find({
      relations: { captain: true, invites: { user: true }, team: true },
      order: { createdAt: 'DESC' },
    });
  }

  async adminCancelDraft(id: string) {
    const draft = await this.drafts.findOne({ where: { id } });
    if (!draft) throw new NotFoundException('Equipo en formación no encontrado');
    if (draft.status === TeamDraftStatus.PENDING) {
      draft.status = TeamDraftStatus.CANCELLED;
      await this.drafts.save(draft);
      await this.draftInvites.update(
        { draftId: draft.id, status: RequestStatus.PENDING },
        { status: RequestStatus.CANCELLED },
      );
    }
    return { ok: true };
  }

  /** Snapshot del perfil sin exigir que esté completo (para reparaciones). */
  private async profileSnapshotSafe(userId: string) {
    const p = await this.profiles.findOne({ where: { userId } });
    return {
      epicUsername: p?.epicUsername ?? null,
      steamUsername: p?.steamUsername ?? null,
      rank: p?.rank ?? null,
      screenshotUrl: p?.screenshotUrl ?? null,
    };
  }

  /**
   * Postula (o re-postula) un equipo en formación COMPLETADO como inscripción.
   * Repara drafts antiguos que quedaron completados sin inscripción asociada y
   * permite reenviar a Inscripciones desde el panel admin.
   */
  async adminSubmitDraft(draftId: string) {
    const draft = await this.drafts.findOne({
      where: { id: draftId },
      relations: { invites: true },
    });
    if (!draft) throw new NotFoundException('Equipo en formación no encontrado');
    if (draft.status === TeamDraftStatus.CANCELLED) {
      throw new BadRequestException('Este equipo en formación fue cancelado');
    }

    // Si ya tiene una inscripción pendiente vigente, no duplicar.
    if (draft.registrationId) {
      const f = await this.forms.findOne({ where: { id: draft.registrationId } });
      if (f && f.status === RegistrationStatus.PENDING) {
        throw new BadRequestException('El equipo ya está postulado a inscripción');
      }
    }

    // Reparación de drafts antiguos: una versión anterior creaba el Team
    // directamente. Si existe un equipo PENDIENTE con el mismo nombre y los
    // jugadores del draft, se descarta (liberando a sus miembros) para volver a
    // pasar por el flujo de inscripción.
    const stale = await this.teams.findOne({ where: { name: draft.teamName } });
    if (stale) {
      if (stale.status === TeamStatus.PENDING) {
        // Soltar la referencia del draft al equipo viejo ANTES de borrarlo,
        // para no reintroducir la FK colgada al guardar el draft luego.
        if (draft.teamId === stale.id) {
          draft.teamId = null;
          await this.drafts.save(draft);
        }
        await this.teamsService.discardTeam(stale.id);
      } else {
        throw new BadRequestException(
          'Ya existe un equipo aprobado con ese nombre; no se puede postular',
        );
      }
    }

    // Capitán + invitados aceptados (orden de aceptación), hasta el roster máximo.
    const accepted = (draft.invites || [])
      .filter((i) => i.status === RequestStatus.ACCEPTED)
      .sort((a, b) => (a.acceptedAt?.getTime() ?? 0) - (b.acceptedAt?.getTime() ?? 0));
    const memberIds = [draft.captainId, ...accepted.map((i) => i.userId)].slice(
      0,
      draft.maxRoster,
    );
    if (memberIds.length < draft.requiredStarters) {
      throw new BadRequestException(
        'El equipo no tiene suficientes jugadores que hayan aceptado',
      );
    }

    // Ninguno puede estar ya en OTRO equipo del torneo.
    for (const uid of memberIds) {
      if (await this.memberOf(uid)) {
        throw new BadRequestException(
          'Un jugador del equipo ya pertenece a otro equipo; no se puede postular',
        );
      }
    }

    const members: {
      userId: string;
      isCaptain?: boolean;
      epicUsername?: string | null;
      steamUsername?: string | null;
      rank?: string | null;
      screenshotUrl?: string | null;
    }[] = [];
    for (const uid of memberIds) {
      members.push({
        userId: uid,
        isCaptain: uid === draft.captainId,
        ...(await this.profileSnapshotSafe(uid)),
      });
    }

    const form = await this.teamsService.createRegistrationFromMembers({
      name: draft.teamName,
      shieldUrl: draft.shieldUrl,
      contactMethod: draft.contactMethod,
      contactValue: draft.contactValue,
      members,
    });

    draft.status = TeamDraftStatus.COMPLETED;
    draft.registrationId = form.id;
    draft.completedAt = draft.completedAt ?? new Date();
    await this.drafts.save(draft);

    for (const m of members) {
      await this.closePlayerPosts(m.userId);
      await this.notifications.notify(
        m.userId,
        NotificationType.TEAM_CREATED,
        `${draft.teamName} fue postulado a inscripción`,
        '/me',
        'El administrador envió tu equipo a Inscripciones y está a la espera de aprobación.',
      );
    }
    return form;
  }

  /** Elimina un equipo en formación del panel (no toca equipos ya creados). */
  async adminDeleteDraft(id: string) {
    const draft = await this.drafts.findOne({ where: { id } });
    if (!draft) throw new NotFoundException('Equipo en formación no encontrado');
    await this.draftInvites.delete({ draftId: id });
    await this.drafts.delete({ id });
    return { ok: true };
  }
}
