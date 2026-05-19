import { Module } from '@nestjs/common';
import { ClipLoaderService } from './clip-loader.service.js';

@Module({
  providers: [ClipLoaderService],
  exports: [ClipLoaderService],
})
export class ClipsModule {}
