export type Brand<TValue, TBrand extends string> = TValue & {
  readonly __brand: TBrand;
};

export type ISODateTime = Brand<string, 'ISODateTime'>;
export type DurationMs = Brand<number, 'DurationMs'>;
export type VersionString = Brand<string, 'VersionString'>;

export type EventId = Brand<string, 'EventId'>;
export type BroadcastObjectId = Brand<string, 'BroadcastObjectId'>;
export type QueueItemId = Brand<string, 'QueueItemId'>;
export type PlacementId = Brand<string, 'PlacementId'>;
export type ModuleId = Brand<string, 'ModuleId'>;
export type SponsorId = Brand<string, 'SponsorId'>;
export type CampaignId = Brand<string, 'CampaignId'>;
export type OperatorId = Brand<string, 'OperatorId'>;
export type CorrelationId = Brand<string, 'CorrelationId'>;
export type AnalyticsRecordId = Brand<string, 'AnalyticsRecordId'>;
export type SceneId = Brand<string, 'SceneId'>;

export interface Size {
  width: number;
  height: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const RUNTIME_STATUSES = [
  'BOOTING',
  'READY',
  'LIVE',
  'DEGRADED',
  'RECOVERY',
  'EMERGENCY',
  'SHUTDOWN'
] as const;

export type RuntimeStatus = (typeof RUNTIME_STATUSES)[number];

export const HEALTH_STATUSES = ['healthy', 'warning', 'degraded', 'fatal', 'unknown'] as const;

export type HealthStatus = (typeof HEALTH_STATUSES)[number];

export const ANIMATION_STATES = [
  'idle',
  'entering',
  'visible',
  'updating',
  'exiting',
  'interrupted',
  'error'
] as const;

export type AnimationState = (typeof ANIMATION_STATES)[number];

export interface RuntimeError {
  code: string;
  message: string;
  source?: string;
  recoverable: boolean;
  timestamp: ISODateTime;
  details?: Record<string, unknown>;
}

export interface RuntimeHealth {
  overall: HealthStatus;
  eventBus: HealthStatus;
  queueEngine: HealthStatus;
  moduleRegistry: HealthStatus;
  layoutEngine: HealthStatus;
  renderer: HealthStatus;
  sponsorPolicy: HealthStatus;
  analytics: HealthStatus;
  cloudControl: HealthStatus;
  obsConnection: HealthStatus;
}

export interface RuntimeStateSnapshot {
  state: RuntimeStatus;
  previousState?: RuntimeStatus;
  stateVersion: number;
  enteredAt: ISODateTime;
  updatedAt: ISODateTime;
  health: RuntimeHealth;
  visible?: boolean;
  animationState?: AnimationState;
  activeObjectId?: BroadcastObjectId;
  activeObjectIds?: BroadcastObjectId[];
  activeModuleId?: ModuleId;
  activePlacementId?: PlacementId;
  queueLength?: number;
  activeSceneId?: SceneId;
  error?: RuntimeError | null;
  metadata?: Record<string, unknown>;
}

export interface ValidationIssue {
  path: string;
  code: string;
  message: string;
}

export type ValidationResult<TValue> =
  | {
      success: true;
      data: TValue;
    }
  | {
      success: false;
      errors: ValidationIssue[];
    };

export interface Clock {
  now(): ISODateTime;
  nowMs(): number;
}

export interface IdProvider {
  createId(prefix?: string): string;
}
