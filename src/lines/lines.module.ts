import { Module } from '@nestjs/common';
import { LineLoaderService } from './line-loader.service.js';

@Module({
  providers: [LineLoaderService],
  exports: [LineLoaderService],
})
export class LinesModule {}
