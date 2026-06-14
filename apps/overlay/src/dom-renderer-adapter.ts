import type { ISODateTime } from '@quacktrack/core';
import type { RendererAdapter, RendererInput, RendererResult } from '@quacktrack/renderer';
import { moduleRegistry } from './modules';

export class DOMRendererAdapter implements RendererAdapter {
  private containerId: string;

  constructor(containerId: string = 'program-canvas') {
    this.containerId = containerId;
  }

  render(input: RendererInput): RendererResult {
    try {
      const container = document.getElementById(this.containerId);
      if (!container) {
        throw new Error(`Target container #${this.containerId} not found in the DOM.`);
      }

      const elementId = `qt-placement-${input.placement.placementId}`;
      let el = document.getElementById(elementId);
      const isNew = !el;

      if (!el) {
        // Clear previous active graphics in the viewport
        container.innerHTML = '';
        
        el = document.createElement('div');
        el.id = elementId;
        el.className = 'qt-module';
      }

      // Apply LayoutEngine resolved absolute bounds
      const { x, y, width, height } = input.placement.bounds;
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      el.style.width = `${width}px`;
      el.style.height = `${height}px`;
      el.style.zIndex = String(input.placement.zIndex || 100);

      const type = input.resolvedModule.object.type;
      if (!(type in moduleRegistry)) {
        throw new Error(`Unsupported module object type in overlay: ${type}`);
      }
      const module = moduleRegistry[type as keyof typeof moduleRegistry];

      if (isNew) {
        module.render(el, input);
        container.appendChild(el);
      } else {
        if (module.update) {
          module.update(el, input);
        } else {
          module.render(el, input);
        }
      }

      return {
        success: true,
        moduleId: input.resolvedModule.moduleId,
        placementId: input.placement.placementId,
        timestamp: new Date().toISOString() as ISODateTime
      };
    } catch (err: any) {
      return {
        success: false,
        error: {
          code: 'DOM_RENDER_FAILED',
          message: err.message ?? 'Unknown DOM render error',
          source: 'DOMRendererAdapter',
          recoverable: true,
          timestamp: new Date().toISOString() as ISODateTime
        }
      };
    }
  }
}
