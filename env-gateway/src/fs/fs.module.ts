import { Module } from '@nestjs/common';
import { FSController } from './fs.controller';
import { FSService } from './fs.service';
import { SyncService } from './sync.service';
import { SharedModule } from 'src/common/shared.module';

@Module({
  imports: [SharedModule],
  controllers: [FSController],
  providers: [FSService, SyncService],
})
export class FSModule {}
