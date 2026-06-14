import type { BroadcastObjectType } from '@quacktrack/objects';
import type { BroadcastModule } from './base-module';
import { PlayerModule } from './player-module';
import { StatModule } from './stat-module';
import { SponsorModule } from './sponsor-module';
import { BreakingModule } from './breaking-module';
import { ReplayModule } from './replay-module';

export * from './base-module';

export const moduleRegistry: Record<
  Extract<BroadcastObjectType, 'player' | 'stat' | 'sponsor' | 'breaking' | 'replay'>,
  BroadcastModule
> = {
  player: new PlayerModule(),
  stat: new StatModule(),
  sponsor: new SponsorModule(),
  breaking: new BreakingModule(),
  replay: new ReplayModule()
};
