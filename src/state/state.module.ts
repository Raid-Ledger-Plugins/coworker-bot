import { Global, Module } from '@nestjs/common';
import { CoworkerConfigService } from '../config/coworker.config.js';
import { StateStoreService } from './state-store.service.js';

@Global()
@Module({
  providers: [CoworkerConfigService, StateStoreService],
  exports: [CoworkerConfigService, StateStoreService],
})
export class StateModule {}
