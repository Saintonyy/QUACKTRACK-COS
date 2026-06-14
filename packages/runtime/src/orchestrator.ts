import { createAnalyticsRecord, type AnalyticsRecord, type AnalyticsWriter } from '@quacktrack/analytics';
import type { BroadcastObjectId, Rect, RuntimeError, Size } from '@quacktrack/core';
import { validateEventEnvelope, type EventEnvelope } from '@quacktrack/events';
import { resolvePlacement, type ResolvedPlacement, type SceneContext, type ReservedZone } from '@quacktrack/layout';
import { type BroadcastObject, type SponsorAttachment } from '@quacktrack/objects';
import { canInterrupt, createQueueItem, selectNextQueueItem, type QueueItem } from '@quacktrack/queue';
import { resolveModuleDefinition, type ModuleRegistryEntry, type ResolvedModuleDefinition } from '@quacktrack/registry';
import { renderResolvedModule, type RendererAdapter, type RendererResult } from '@quacktrack/renderer';
import { evaluateSponsorPolicy, type SponsorConfig } from '@quacktrack/sponsor-policy';
import { EventBus } from './event-bus';
import { RuntimeHealthMonitor } from './health-monitor';
import { ObjectStore } from './object-store';
import { StateManager } from './state-manager';
import type { RuntimeExecutionResult } from './types';

export interface RuntimeOrchestratorDependencies {
  eventBus: EventBus;
  stateManager: StateManager;
  objectStore: ObjectStore;
  healthMonitor: RuntimeHealthMonitor;
  moduleRegistry: ModuleRegistryEntry[];
  sponsorConfig: SponsorConfig;
  sceneContext: SceneContext;
  outputResolution: Size;
  reservedZones?: ReservedZone[];
  scorebugBounds?: Rect;
  rendererAdapter?: RendererAdapter;
  analyticsWriter?: AnalyticsWriter;
}

function createObjectFromEvent(event: EventEnvelope, objectId: string): BroadcastObject {
  const mapping: Record<string, { type: any; family: any }> = {
    PLAYER_INTRODUCTION: { type: 'player', family: 'Person Context' },
    PLAYER_STAT: { type: 'stat', family: 'Performance Context' },
    SPONSOR_MOMENT: { type: 'sponsor', family: 'Commercial Context' },
    BREAKING_UPDATE: { type: 'breaking', family: 'Game Context' },
    REPLAY_CONTEXT: { type: 'replay', family: 'Game Context' }
  };

  const mapped = mapping[event.name];
  if (!mapped) {
    throw new Error(`Unsupported event for object creation: ${event.name}`);
  }

  const obj: BroadcastObject = {
    id: objectId as any,
    objectVersion: 1,
    schemaVersion: '1.0' as any,
    type: mapped.type,
    family: mapped.family,
    lifecycle: 'CREATED',
    priority: event.priority ?? 'normal',
    payload: event.payload as any,
    analytics: {
      impressions: 0,
      displayTime: 0 as any,
      interruptionCount: 0,
      operatorSource: event.source
    },
    source: {
      eventId: event.id,
      eventName: event.name,
      source: event.source,
      sourceType: event.sourceType,
      timestamp: event.timestamp
    },
    createdAt: event.timestamp
  };

  if (event.permissions !== undefined) {
    obj.permissions = event.permissions;
  }
  if (event.options?.duration !== undefined || event.options?.autoHide !== undefined || event.options?.expiresAt !== undefined || event.options?.scheduledFor !== undefined || event.options?.manualHold !== undefined) {
    obj.timing = {};
    if (event.options.duration !== undefined) obj.timing.duration = event.options.duration;
    if (event.options.autoHide !== undefined) obj.timing.autoHide = event.options.autoHide;
    if (event.options.expiresAt !== undefined) obj.timing.expiresAt = event.options.expiresAt;
    if (event.options.scheduledFor !== undefined) obj.timing.scheduledFor = event.options.scheduledFor;
    if (event.options.manualHold !== undefined) obj.timing.manualHold = event.options.manualHold;
  }
  if (event.correlationId !== undefined) {
    obj.correlationId = event.correlationId;
  }
  if (event.operatorId !== undefined) {
    obj.source.operatorId = event.operatorId;
  }

  return obj;
}

export class RuntimeOrchestrator {
  private queue: QueueItem[] = [];
  private activeItem: QueueItem | undefined = undefined;

  getQueue(): QueueItem[] {
    return this.queue;
  }

  getActiveItem(): QueueItem | undefined {
    return this.activeItem;
  }

  constructor(private deps: RuntimeOrchestratorDependencies) {
    this.deps.eventBus.subscribe((event) => {
      this.processEvent(event);
    });
  }

  processEvent(event: EventEnvelope): RuntimeExecutionResult {
    const analyticsRecords: AnalyticsRecord[] = [];
    const errors: RuntimeError[] = [];
    let resolvedObject: BroadcastObject | undefined;
    let queueItem: QueueItem | undefined;
    let resolvedModule: ResolvedModuleDefinition | undefined;
    let resolvedPlacement: ResolvedPlacement | undefined;
    let rendererResult: RendererResult | undefined;

    // 1. Validate event
    const validation = validateEventEnvelope(event);
    if (!validation.success) {
      this.deps.healthMonitor.recordEventRejected();
      const err: RuntimeError = {
        code: 'EVENT_VALIDATION_FAILED',
        message: validation.errors.map((e: any) => `${e.path}: ${e.message}`).join('; '),
        source: 'RuntimeOrchestrator',
        recoverable: true,
        timestamp: event.timestamp
      };
      errors.push(err);
      this.deps.healthMonitor.recordError(err);

      const recId = `an_${event.id}_rejected`;
      const recResult = createAnalyticsRecord({
        id: recId as any,
        analyticsType: 'event.rejected',
        timestamp: event.timestamp,
        eventId: event.id,
        payload: { errors: validation.errors }
      });
      if (recResult.success) {
        this.deps.analyticsWriter?.append(recResult.data);
        analyticsRecords.push(recResult.data);
      }

      const result: RuntimeExecutionResult = {
        accepted: false,
        event,
        analyticsRecords
      };
      if (errors.length > 0) {
        result.errors = errors;
      }
      return result;
    }

    // Write accepted record
    const acceptId = `an_${event.id}_accepted`;
    const acceptRec = createAnalyticsRecord({
      id: acceptId as any,
      analyticsType: 'event.accepted',
      timestamp: event.timestamp,
      eventId: event.id,
      payload: {}
    });
    if (acceptRec.success) {
      this.deps.analyticsWriter?.append(acceptRec.data);
      analyticsRecords.push(acceptRec.data);
    }
    this.deps.healthMonitor.recordEventProcessed();

    // Handle Control Events
    if (event.name === 'COS_HIDE') {
      if (this.activeItem) {
        const oldItem = this.activeItem;
        oldItem.status = 'completed';
        this.activeItem = undefined;

        const obj = this.deps.objectStore.getObject(oldItem.objectId);
        if (obj) {
          obj.lifecycle = 'COMPLETED';
          obj.completedAt = event.timestamp;
          obj.objectVersion += 1;
          this.deps.objectStore.updateObject(obj);
        }

        const compRec = createAnalyticsRecord({
          id: `an_${event.id}_completed` as any,
          analyticsType: 'object.completed',
          timestamp: event.timestamp,
          objectId: oldItem.objectId,
          queueItemId: oldItem.id,
          payload: {}
        });
        if (compRec.success) {
          this.deps.analyticsWriter?.append(compRec.data);
          analyticsRecords.push(compRec.data);
        }
      }

      this.commitState();
      const result: RuntimeExecutionResult = {
        accepted: true,
        event,
        analyticsRecords
      };
      if (errors.length > 0) {
        result.errors = errors;
      }
      return result;
    }

    if (event.name === 'QUEUE_NEXT') {
      if (this.activeItem) {
        const oldItem = this.activeItem;
        oldItem.status = 'completed';
        const obj = this.deps.objectStore.getObject(oldItem.objectId);
        if (obj) {
          obj.lifecycle = 'COMPLETED';
          obj.completedAt = event.timestamp;
          obj.objectVersion += 1;
          this.deps.objectStore.updateObject(obj);
        }
        this.activeItem = undefined;
      }

      const nextDecision = selectNextQueueItem(this.queue, event.timestamp);
      if (nextDecision.accepted && nextDecision.item) {
        queueItem = nextDecision.item;
        queueItem.status = 'active';
        this.activeItem = queueItem;

        resolvedObject = this.deps.objectStore.getObject(queueItem.objectId);
        if (resolvedObject) {
          resolvedObject.lifecycle = 'VISIBLE';
          resolvedObject.shownAt = event.timestamp;
          resolvedObject.objectVersion += 1;
          this.deps.objectStore.updateObject(resolvedObject);

          const resolveInput: any = {
            registry: this.deps.moduleRegistry,
            object: resolvedObject,
            sceneType: this.deps.sceneContext.sceneType
          };
          if (resolvedObject.sponsor) {
            resolveInput.sponsorPolicyDecision = {
              policy: resolvedObject.sponsor.policy,
              allowed: resolvedObject.sponsor.policy !== 'suppressed'
            };
          }

          const registryRes = resolveModuleDefinition(resolveInput);

          if (registryRes.success) {
            resolvedModule = registryRes.data;

            const layoutRequest: any = {
              object: resolvedObject,
              resolvedModule,
              sceneContext: this.deps.sceneContext,
              outputResolution: this.deps.outputResolution,
              activePlacements: [],
              reservedZones: this.deps.reservedZones ?? [],
              runtimePriority: resolvedObject.priority
            };
            if (this.deps.scorebugBounds !== undefined) {
              layoutRequest.scorebugBounds = this.deps.scorebugBounds;
            }

            const layoutRes = resolvePlacement(layoutRequest);

            if (layoutRes.success) {
              resolvedPlacement = layoutRes.data;

              const renderRes = this.deps.rendererAdapter
                ? this.deps.rendererAdapter.render({ resolvedModule, placement: resolvedPlacement })
                : renderResolvedModule({ resolvedModule, placement: resolvedPlacement }, event.timestamp);
              rendererResult = renderRes;

              if (!renderRes.success) {
                this.deps.healthMonitor.recordRendererFailure();
                errors.push(renderRes.error);
                this.deps.healthMonitor.recordError(renderRes.error);
              } else {
                const visRec = createAnalyticsRecord({
                  id: `an_${event.id}_visible` as any,
                  analyticsType: 'object.visible',
                  timestamp: event.timestamp,
                  objectId: resolvedObject.id,
                  queueItemId: queueItem.id,
                  moduleId: resolvedModule.moduleId,
                  placementId: resolvedPlacement.placementId,
                  payload: {}
                });
                if (visRec.success) {
                  this.deps.analyticsWriter?.append(visRec.data);
                  analyticsRecords.push(visRec.data);
                }
              }
            } else {
              const err: RuntimeError = {
                code: 'LAYOUT_RESOLUTION_FAILED',
                message: layoutRes.errors.map((e: any) => `${e.path}: ${e.message}`).join('; '),
                source: 'LayoutEngine',
                recoverable: true,
                timestamp: event.timestamp
              };
              errors.push(err);
              this.deps.healthMonitor.recordError(err);
            }
          }
        }
      }

      this.commitState();
      const result: RuntimeExecutionResult = {
        accepted: true,
        event,
        analyticsRecords
      };
      if (resolvedObject !== undefined) result.object = resolvedObject;
      if (queueItem !== undefined) result.queueItem = queueItem;
      if (resolvedModule !== undefined) result.resolvedModule = resolvedModule;
      if (resolvedPlacement !== undefined) result.resolvedPlacement = resolvedPlacement;
      if (rendererResult !== undefined) result.rendererResult = rendererResult;
      if (errors.length > 0) result.errors = errors;
      return result;
    }

    if (event.name === 'EMERGENCY_CLEAR') {
      if (this.activeItem) {
        this.activeItem.status = 'interrupted';
        const obj = this.deps.objectStore.getObject(this.activeItem.objectId);
        if (obj) {
          obj.lifecycle = 'INTERRUPTED';
          obj.objectVersion += 1;
          this.deps.objectStore.updateObject(obj);
        }
        this.activeItem = undefined;
      }

      for (const item of this.queue) {
        if (item.status === 'pending' || item.status === 'scheduled') {
          item.status = 'removed';
          const obj = this.deps.objectStore.getObject(item.objectId);
          if (obj) {
            obj.lifecycle = 'ARCHIVED';
            obj.objectVersion += 1;
            this.deps.objectStore.updateObject(obj);
          }
        }
      }

      this.deps.stateManager.transitionTo('EMERGENCY');
      this.deps.healthMonitor.recordStateTransition();

      this.commitState();
      const result: RuntimeExecutionResult = {
        accepted: true,
        event,
        analyticsRecords
      };
      if (errors.length > 0) {
        result.errors = errors;
      }
      return result;
    }

    // Handle Context Events (PLAYER_INTRODUCTION, PLAYER_STAT, SPONSOR_MOMENT, BREAKING_UPDATE)
    const targetId = event.targetObjectId ?? (`obj_${event.id}` as BroadcastObjectId);
    const existing = this.deps.objectStore.getObject(targetId);

    let objectModel: BroadcastObject;
    if (existing) {
      objectModel = {
        ...existing,
        objectVersion: existing.objectVersion + 1,
        payload: event.payload as any,
        updatedAt: event.timestamp,
        lifecycle: 'VALIDATED'
      };
    } else {
      try {
        objectModel = createObjectFromEvent(event, targetId);
      } catch (err: any) {
        const runtimeErr: RuntimeError = {
          code: 'OBJECT_CREATION_FAILED',
          message: err.message,
          source: 'ObjectStore',
          recoverable: true,
          timestamp: event.timestamp
        };
        errors.push(runtimeErr);
        this.deps.healthMonitor.recordError(runtimeErr);
        const result: RuntimeExecutionResult = {
          accepted: false,
          event,
          analyticsRecords
        };
        if (errors.length > 0) result.errors = errors;
        return result;
      }
    }

    // 2. Evaluate sponsor policy on memory model
    const sponsorDecision = evaluateSponsorPolicy({
      object: objectModel,
      config: this.deps.sponsorConfig,
      sceneType: this.deps.sceneContext.sceneType
    });

    if (sponsorDecision.allowed && sponsorDecision.sponsorId) {
      const sponsorAttachment: SponsorAttachment = {
        sponsorId: sponsorDecision.sponsorId,
        sponsorName: sponsorDecision.sponsorName ?? '',
        sponsorSlot: sponsorDecision.sponsorSlot ?? '',
        displayMode: sponsorDecision.displayMode,
        policy: sponsorDecision.policy,
        fulfillmentStatus: 'pending'
      };
      if (sponsorDecision.campaignId !== undefined) {
        sponsorAttachment.campaignId = sponsorDecision.campaignId;
      }
      if (sponsorDecision.requiredDuration !== undefined) {
        sponsorAttachment.requiredDuration = sponsorDecision.requiredDuration;
      }
      objectModel.sponsor = sponsorAttachment;
    } else {
      objectModel.sponsor = null;
    }

    // 3. Resolve Module definition
    const resolveInput: any = {
      registry: this.deps.moduleRegistry,
      object: objectModel,
      sceneType: this.deps.sceneContext.sceneType,
      sponsorPolicyDecision: sponsorDecision
    };
    const registryRes = resolveModuleDefinition(resolveInput);

    if (!registryRes.success) {
      const err: RuntimeError = {
        code: 'MODULE_RESOLUTION_FAILED',
        message: registryRes.errors.map((e: any) => `${e.path}: ${e.message}`).join('; '),
        source: 'ModuleRegistry',
        recoverable: true,
        timestamp: event.timestamp
      };
      errors.push(err);
      this.deps.healthMonitor.recordError(err);
      const result: RuntimeExecutionResult = {
        accepted: false,
        event,
        analyticsRecords
      };
      if (objectModel !== undefined) result.object = objectModel;
      if (errors.length > 0) result.errors = errors;
      return result;
    }
    resolvedModule = registryRes.data;

    // 4. Create QueueItem
    const entry = this.deps.moduleRegistry.find((e) => e.objectType === objectModel.type);
    const queueInput: any = {
      id: `queue_${event.id}` as any,
      object: objectModel,
      eventName: event.name,
      moduleId: resolvedModule.moduleId,
      autoHide: entry?.timing?.autoHide ?? true,
      createdAt: event.timestamp,
      triggerSource: event.source,
      supportsInterruption: entry?.capabilities?.supportsSponsor ?? true
    };
    if (entry?.timing?.duration !== undefined) {
      queueInput.duration = entry.timing.duration;
      queueInput.expiration = {
        expiresAfter: entry.timing.duration
      };
    } else {
      queueInput.expiration = {};
    }

    const queueItemRes = createQueueItem(queueInput);
    if (!queueItemRes.success) {
      const err: RuntimeError = {
        code: 'QUEUE_ITEM_CREATION_FAILED',
        message: queueItemRes.errors.map((e: any) => `${e.path}: ${e.message}`).join('; '),
        source: 'QueueEngine',
        recoverable: true,
        timestamp: event.timestamp
      };
      errors.push(err);
      this.deps.healthMonitor.recordError(err);
      const result: RuntimeExecutionResult = {
        accepted: false,
        event,
        analyticsRecords
      };
      if (objectModel !== undefined) result.object = objectModel;
      if (errors.length > 0) result.errors = errors;
      return result;
    }
    queueItem = queueItemRes.data;

    // 5. Determine activation status / Interruption logic
    let shouldBeActive = false;
    const queueBehavior = event.options?.queueBehavior;

    if (queueBehavior === 'showNow') {
      shouldBeActive = true;
      if (this.activeItem) {
        // Interrupt active item
        const oldItem = this.activeItem;
        oldItem.status = 'interrupted';

        const oldObj = this.deps.objectStore.getObject(oldItem.objectId);
        if (oldObj) {
          oldObj.lifecycle = 'INTERRUPTED';
          oldObj.objectVersion += 1;
          this.deps.objectStore.updateObject(oldObj);
        }

        const interruptRec = createAnalyticsRecord({
          id: `an_${event.id}_interrupted` as any,
          analyticsType: 'object.interrupted',
          timestamp: event.timestamp,
          objectId: oldItem.objectId,
          queueItemId: oldItem.id,
          payload: { reason: 'priority_preemption' }
        });
        if (interruptRec.success) {
          this.deps.analyticsWriter?.append(interruptRec.data);
          analyticsRecords.push(interruptRec.data);
        }
      }
    } else if (queueBehavior === 'queue') {
      // queueBehavior === 'queue'
      queueItem.status = 'pending';
      objectModel.lifecycle = 'QUEUED';
      objectModel.queuedAt = event.timestamp;
    } else {
      // Backwards compatible fallback (priority preemption rules)
      if (this.activeItem) {
        if (canInterrupt(queueItem, this.activeItem)) {
          shouldBeActive = true;

          // Interrupt active item
          const oldItem = this.activeItem;
          oldItem.status = 'interrupted';

          const oldObj = this.deps.objectStore.getObject(oldItem.objectId);
          if (oldObj) {
            oldObj.lifecycle = 'INTERRUPTED';
            oldObj.objectVersion += 1;
            this.deps.objectStore.updateObject(oldObj);
          }

          const interruptRec = createAnalyticsRecord({
            id: `an_${event.id}_interrupted` as any,
            analyticsType: 'object.interrupted',
            timestamp: event.timestamp,
            objectId: oldItem.objectId,
            queueItemId: oldItem.id,
            payload: { reason: 'priority_preemption' }
          });
          if (interruptRec.success) {
            this.deps.analyticsWriter?.append(interruptRec.data);
            analyticsRecords.push(interruptRec.data);
          }
        } else {
          // Queue it
          queueItem.status = 'pending';
          objectModel.lifecycle = 'QUEUED';
          objectModel.queuedAt = event.timestamp;
        }
      } else {
        shouldBeActive = true;
      }
    }

    if (shouldBeActive) {
      queueItem.status = 'active';
      this.activeItem = queueItem;
      objectModel.lifecycle = 'VISIBLE';
      objectModel.shownAt = event.timestamp;
    }

    // Save to ObjectStore (once)
    try {
      if (existing) {
        this.deps.objectStore.updateObject(objectModel);
      } else {
        this.deps.objectStore.addObject(objectModel);
      }
      resolvedObject = objectModel;
    } catch (err: any) {
      const runtimeErr: RuntimeError = {
        code: existing ? 'STALE_OBJECT_UPDATE' : 'OBJECT_CREATION_FAILED',
        message: err.message,
        source: 'ObjectStore',
        recoverable: true,
        timestamp: event.timestamp
      };
      errors.push(runtimeErr);
      this.deps.healthMonitor.recordError(runtimeErr);
      const result: RuntimeExecutionResult = {
        accepted: false,
        event,
        analyticsRecords
      };
      if (errors.length > 0) result.errors = errors;
      return result;
    }

    this.queue.push(queueItem);

    // Write analytics records
    const objRecType = event.targetObjectId && existing ? 'object.updated' : 'object.created';
    const objRec = createAnalyticsRecord({
      id: `an_${event.id}_obj` as any,
      analyticsType: objRecType,
      timestamp: event.timestamp,
      objectId: resolvedObject.id,
      payload: {}
    });
    if (objRec.success) {
      this.deps.analyticsWriter?.append(objRec.data);
      analyticsRecords.push(objRec.data);
    }

    // Resolve Layout and Render if item is active
    if (queueItem.status === 'active') {
      const layoutRequest: any = {
        object: resolvedObject,
        resolvedModule,
        sceneContext: this.deps.sceneContext,
        outputResolution: this.deps.outputResolution,
        activePlacements: [],
        reservedZones: this.deps.reservedZones ?? [],
        runtimePriority: resolvedObject.priority
      };
      if (this.deps.scorebugBounds !== undefined) {
        layoutRequest.scorebugBounds = this.deps.scorebugBounds;
      }

      const layoutRes = resolvePlacement(layoutRequest);

      if (layoutRes.success) {
        resolvedPlacement = layoutRes.data;

        const renderRes = this.deps.rendererAdapter
          ? this.deps.rendererAdapter.render({ resolvedModule, placement: resolvedPlacement })
          : renderResolvedModule({ resolvedModule, placement: resolvedPlacement }, event.timestamp);
        rendererResult = renderRes;

        if (!renderRes.success) {
          this.deps.healthMonitor.recordRendererFailure();
          errors.push(renderRes.error);
          this.deps.healthMonitor.recordError(renderRes.error);
        } else {
          const visRec = createAnalyticsRecord({
            id: `an_${event.id}_visible` as any,
            analyticsType: 'object.visible',
            timestamp: event.timestamp,
            objectId: resolvedObject.id,
            queueItemId: queueItem.id,
            moduleId: resolvedModule.moduleId,
            placementId: resolvedPlacement.placementId,
            payload: {}
          });
          if (visRec.success) {
            this.deps.analyticsWriter?.append(visRec.data);
            analyticsRecords.push(visRec.data);
          }
        }
      } else {
        const err: RuntimeError = {
          code: 'LAYOUT_RESOLUTION_FAILED',
          message: layoutRes.errors.map((e: any) => `${e.path}: ${e.message}`).join('; '),
          source: 'LayoutEngine',
          recoverable: true,
          timestamp: event.timestamp
        };
        errors.push(err);
        this.deps.healthMonitor.recordError(err);
      }
    }

    this.commitState();

    const result: RuntimeExecutionResult = {
      accepted: true,
      event,
      analyticsRecords
    };
    if (resolvedObject !== undefined) result.object = resolvedObject;
    if (queueItem !== undefined) result.queueItem = queueItem;
    if (resolvedModule !== undefined) result.resolvedModule = resolvedModule;
    if (resolvedPlacement !== undefined) result.resolvedPlacement = resolvedPlacement;
    if (rendererResult !== undefined) result.rendererResult = rendererResult;
    if (errors.length > 0) result.errors = errors;
    return result;
  }

  updateSceneContext(sceneType: 'live_game' | 'replay'): void {
    this.deps.sceneContext.sceneType = sceneType;
    this.deps.sceneContext.sceneId = `scene_${sceneType}` as any;
    this.commitState();
  }

  private commitState(): void {
    const pendingCount = this.queue.filter((i) => i.status === 'pending').length;
    this.deps.healthMonitor.recordQueueDepth(pendingCount);

    const update: Partial<any> = {
      visible: !!this.activeItem,
      queueLength: pendingCount,
      activeSceneId: this.deps.sceneContext.sceneId
    };

    if (this.activeItem !== undefined) {
      update.activeObjectId = this.activeItem.objectId;
      update.activeModuleId = this.activeItem.moduleId;
      update.activePlacementId = `placement_${this.activeItem.objectId}_${this.activeItem.moduleId}`;
    }

    this.deps.stateManager.commit(update);
  }
}
