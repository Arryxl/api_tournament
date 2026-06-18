import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ReplaysService } from './replays.service';
import { CurrentUser, Roles } from '../common/decorators';
import { UserRole } from '../common/enums';

const replayUpload = {
  storage: memoryStorage(),
  fileFilter: (_req: any, file: any, cb: any) => {
    if (!/\.replay$/i.test(file.originalname)) {
      return cb(new BadRequestException('Solo se aceptan archivos .replay'), false);
    }
    cb(null, true);
  },
  limits: {
    fileSize: parseInt(process.env.REPLAY_MAX_SIZE || '20971520', 10), // 20 MB
  },
};

@Controller('replays')
export class ReplaysController {
  constructor(private readonly replays: ReplaysService) {}

  /** Sube un `.replay` para un partido. Capitán de uno de los equipos o admin. */
  @Post()
  @UseInterceptors(FileInterceptor('file', replayUpload))
  upload(
    @UploadedFile() file: Express.Multer.File,
    @Body('matchCode') matchCode: string,
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') role: UserRole,
  ) {
    return this.replays.ingest(file, matchCode, userId, role);
  }

  /** Previsualiza un replay para autocompletar el editor de Resultado (admin). */
  @Roles(UserRole.ADMIN)
  @Post('preview')
  @UseInterceptors(FileInterceptor('file', replayUpload))
  preview(
    @UploadedFile() file: Express.Multer.File,
    @Body('matchCode') matchCode: string,
  ) {
    return this.replays.preview(file, matchCode);
  }

  @Roles(UserRole.ADMIN)
  @Get()
  list() {
    return this.replays.list();
  }

  @Roles(UserRole.ADMIN)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.replays.findOne(id);
  }

  @Roles(UserRole.ADMIN)
  @Post(':id/reprocess')
  reprocess(@Param('id') id: string) {
    return this.replays.reprocess(id);
  }

  @Roles(UserRole.ADMIN)
  @Post(':id/resolve')
  resolve(
    @Param('id') id: string,
    @Body()
    body: {
      matchCode?: string;
      assignments?: {
        platform: string;
        platformId: string;
        userId: string;
        teamId: string;
      }[];
    },
  ) {
    return this.replays.manualResolve(id, body);
  }

  @Roles(UserRole.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.replays.remove(id);
  }
}
