import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { randomUUID } from 'crypto';
import { Public } from '../common/decorators';

const storage = diskStorage({
  destination: process.env.UPLOAD_DIR || './uploads',
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
}
