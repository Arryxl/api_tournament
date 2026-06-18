import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { LinkingService } from './linking.service';
import { CurrentUser, Public, Roles } from '../common/decorators';
import { LinkedPlatform, UserRole } from '../common/enums';

function parsePlatform(value: string): LinkedPlatform {
  if (value === LinkedPlatform.STEAM || value === LinkedPlatform.EPIC) {
    return value;
  }
  throw new BadRequestException(`Plataforma no soportada: ${value}`);
}

@Controller('link')
export class LinkingController {
  constructor(private readonly linking: LinkingService) {}

  /** Estado de vinculación del usuario actual (para el modal/gate del front). */
  @Get('me')
  status(@CurrentUser('userId') userId: string) {
    return this.linking.statusForUser(userId);
  }

  /** [ADMIN] Estado de vinculación de todos los miembros de un equipo. */
  @Roles(UserRole.ADMIN)
  @Get('team/:teamId')
  team(@Param('teamId') teamId: string) {
    return this.linking.teamReadiness(teamId);
  }

  /**
   * Inicia la vinculación: devuelve la URL del proveedor. El front la abre con
   * `window.location` (no es un redirect directo porque esta ruta va con JWT).
   */
  @Get(':platform/start')
  start(
    @CurrentUser('userId') userId: string,
    @Param('platform') platform: string,
  ) {
    return this.linking.start(userId, parsePlatform(platform));
  }

  /** Callback del proveedor (lo invoca el navegador del usuario, sin JWT). */
  @Public()
  @Get(':platform/callback')
  async callback(
    @Param('platform') platform: string,
    @Query() query: Record<string, string>,
    @Res() res: Response,
  ) {
    const p = parsePlatform(platform);
    try {
      if (p === LinkedPlatform.STEAM) {
        await this.linking.handleSteamCallback(query);
      } else {
        await this.linking.handleEpicCallback(query);
      }
      return res.redirect(this.linking.resultRedirect(p, true));
    } catch (err: any) {
      const reason = err?.message || 'error';
      return res.redirect(this.linking.resultRedirect(p, false, reason));
    }
  }

  /** Desvincula una cuenta de plataforma del usuario actual. */
  @Delete(':platform')
  unlink(
    @CurrentUser('userId') userId: string,
    @Param('platform') platform: string,
  ) {
    return this.linking.unlink(userId, parsePlatform(platform));
  }
}
