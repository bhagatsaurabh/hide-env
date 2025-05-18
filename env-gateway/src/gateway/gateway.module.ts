import { Module } from '@nestjs/common';
import { GatewayController } from './gateway.controller';
import { FSService } from './fs.service';
import { SyncService } from './sync.service';
import { SharedService } from 'src/common/shared.service';

@Module({
  controllers: [GatewayController],
  providers: [FSService, SyncService, SharedService],
})
export class GatewayModule {}
