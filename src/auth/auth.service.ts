import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../entities';
import { UserRole } from '../common/enums';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly jwt: JwtService,
  ) {}

  async validateUser(username: string, password: string): Promise<User> {
    const user = await this.users.findOne({ where: { username } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    return user;
  }

  private buildTokens(user: User) {
    const payload = { sub: user.id, username: user.username, role: user.role };
    const accessToken = this.jwt.sign(payload, {
      secret: process.env.JWT_SECRET || 'gravity_secret_key_2025',
      expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    } as any);
    const refreshToken = this.jwt.sign(
      { sub: user.id },
      {
        secret: process.env.JWT_REFRESH_SECRET || 'gravity_refresh_secret_2025',
        expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
      } as any,
    );
    return { accessToken, refreshToken };
  }

  private publicUser(user: User) {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      coins: user.coins,
    };
  }

  async login(username: string, password: string) {
    const user = await this.validateUser(username, password);
    return { ...this.buildTokens(user), user: this.publicUser(user) };
  }

  async refresh(refreshToken: string) {
    try {
      const decoded = this.jwt.verify(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET || 'gravity_refresh_secret_2025',
      });
      const user = await this.users.findOne({ where: { id: decoded.sub } });
      if (!user || !user.isActive) {
        throw new UnauthorizedException();
      }
      return this.buildTokens(user);
    } catch {
      throw new UnauthorizedException('Refresh token inválido');
    }
  }

  async me(userId: string) {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException();
    }
    return this.publicUser(user);
  }

  async register(username: string, password: string, email?: string) {
    const existing = await this.users.findOne({ where: { username } });
    if (existing) {
      throw new UnauthorizedException('El usuario ya existe');
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const user = this.users.create({
      username,
      email: email ?? null,
      passwordHash,
      role: UserRole.PUBLIC,
      coins: 50, // bono de bienvenida
    });
    await this.users.save(user);
    return { ...this.buildTokens(user), user: this.publicUser(user) };
  }
}
