import { Module } from '@nestjs/common';
import { AudioRecorderService } from './audio-recorder.service.js';
import { ClipSelectorService } from './clip-selector.service.js';
import { ListenerService } from './listener.service.js';
import { TranscriberService } from './transcriber.service.js';

@Module({
  providers: [
    AudioRecorderService,
    TranscriberService,
    ClipSelectorService,
    ListenerService,
  ],
  exports: [ListenerService],
})
export class ListenerModule {}
