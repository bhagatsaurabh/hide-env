import { Module } from '@nestjs/common';
import { FSController } from './fs.controller';
import { FSService } from './fs.service';
import { SharedModule } from 'src/common/shared.module';

@Module({
  imports: [SharedModule],
  controllers: [FSController],
  providers: [FSService],
})
export class FSModule {}
