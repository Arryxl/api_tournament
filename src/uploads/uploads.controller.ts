import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, resolve } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { randomUUID } from 'crypto';
import { Public, Roles } from '../common/decorators';
import { UserRole } from '../common/enums';

const UPLOAD_ROOT = process.env.UPLOAD_DIR || './uploads';

const storage = diskStorage({
  destination: UPLOAD_ROOT,
  filename: (_req, file, cb) => {
    cb(null, `${randomUUID()}${extname(file.originalname)}`);
  },
});

// Escudos de equipos predefinidos en su carpeta dedicada (orden + edición).
const presetTeamDir = resolve(UPLOAD_ROOT, 'preset-teams');
if (!existsSync(presetTeamDir)) mkdirSync(presetTeamDir, { recursive: true });
const presetStorage = diskStorage({
  destination: presetTeamDir,
  filename: (_req, file, cb) => {
    cb(null, `${randomUUID()}${extname(file.originalname)}`);
  },
});

const imageFilter = (_req: any, file: any, cb: any) => {
  if (!/\.(jpg|jpeg|png|svg|webp)$/i.test(file.originalname)) {
    return cb(new BadRequestException('Formato de imagen no permitido'), false);
  }
  cb(null, true);
};

const options = {
  storage,
  fileFilter: imageFilter,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE || '2097152', 10) },
};

@Controller('uploads')
export class UploadsController {
  private url(file: Express.Multer.File) {
    return { url: `/uploads/${file.filename}`, filename: file.filename };
  }

  @Public()
  @Post('shield')
  @UseInterceptors(FileInterceptor('file', options))
  shield(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No se recibió archivo');
    return this.url(file);
  }

  @Public()
  @Post('screenshot')
  @UseInterceptors(FileInterceptor('file', options))
  screenshot(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No se recibió archivo');
    return this.url(file);
  }

  /** Escudo de un equipo predefinido (solo admin, carpeta dedicada). */
  @Roles(UserRole.ADMIN)
  @Post('preset-team')
  @UseInterceptors(
    FileInterceptor('file', { ...options, storage: presetStorage }),
  )
  presetTeam(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No se recibió archivo');
    return {
      url: `/uploads/preset-teams/${file.filename}`,
      filename: file.filename,
    };
  }
}
