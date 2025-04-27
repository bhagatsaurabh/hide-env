import { Module } from '@nestjs/common';
import { FSModule } from './fs/fs.module';

@Module({
  imports: [FSModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
