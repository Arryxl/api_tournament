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
  User,
} from '../entities';
import {
  PlayerRank,
  RegistrationStatus,
  TeamStatus,
  UserRole,
} from '../common/enums';

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
    private readonly dataSource: DataSource,
  ) {}

  findAll() {
    return this.teams.find({
      relations: { members: true, group: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string) {
    const team = await this.teams.findOne({
      where: { id },
      relations: { members: { user: true }, group: true, captain: true },
    });
    if (!team) throw new NotFoundException('Equipo no encontrado');
    return team;
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
      });
      await manager.save(team);

      const players = [
        {
          epic: form.player1Epic,
          steam: form.player1Steam,
          rank: form.player1Rank,
          shot: form.player1Screenshot,
        },
        {
          epic: form.player2Epic,
          steam: form.player2Steam,
          rank: form.player2Rank,
          shot: form.player2Screenshot,
        },
        {
          epic: form.player3Epic,
          steam: form.player3Steam,
          rank: form.player3Rank,
          shot: form.player3Screenshot,
        },
      ];

      const generated: { playerNumber: number; username: string; password: string }[] = [];
      let captainId: string | null = null;

      for (let i = 0; i < players.length; i++) {
        const p = players[i];
        const cred = credentials?.[i];
        const baseName =
          (p.epic || p.steam || `${form.teamName}_p${i + 1}`)
            .toLowerCase()
            .replace(/[^a-z0-9_]/g, '')
            .slice(0, 40) || `${form.teamName.toLowerCase()}p${i + 1}`;
        const username = cred?.username || `${baseName}_${Math.random().toString(36).slice(2, 6)}`;
        const password = cred?.password || Math.random().toString(36).slice(2, 10);

        const user = manager.create(User, {
          username,
          passwordHash: await bcrypt.hash(password, 10),
          role: UserRole.CANDIDATE,
          coins: 0,
        });
        await manager.save(user);

        const isCaptain = form.captainPlayer === i + 1;
        if (isCaptain) captainId = user.id;

        const member = manager.create(TeamMember, {
          teamId: team.id,
          userId: user.id,
          epicUsername: p.epic,
          steamUsername: p.steam,
          rank: (p.rank as PlayerRank) ?? null,
          screenshotUrl: p.shot,
          isCaptain,
          playerNumber: i + 1,
        });
        await manager.save(member);

        generated.push({ playerNumber: i + 1, username, password });
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
