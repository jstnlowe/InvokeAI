import { rgbaColorToString } from 'common/util/colorCodeTransformers';
import type { CanvasManager } from 'features/controlLayers/konva/CanvasManager';
import {
  BRUSH_BORDER_INNER_COLOR,
  BRUSH_BORDER_OUTER_COLOR,
  BRUSH_ERASER_BORDER_WIDTH,
} from 'features/controlLayers/konva/constants';
import { alignCoordForTool } from 'features/controlLayers/konva/util';
import Konva from 'konva';

export class CanvasTool {
  static NAME_PREFIX = 'tool';

  static GROUP_NAME = `${CanvasTool.NAME_PREFIX}_group`;

  static BRUSH_NAME_PREFIX = `${CanvasTool.NAME_PREFIX}_brush`;
  static BRUSH_GROUP_NAME = `${CanvasTool.BRUSH_NAME_PREFIX}_group`;
  static BRUSH_FILL_CIRCLE_NAME = `${CanvasTool.BRUSH_NAME_PREFIX}_fill-circle`;
  static BRUSH_INNER_BORDER_CIRCLE_NAME = `${CanvasTool.BRUSH_NAME_PREFIX}_inner-border-circle`;
  static BRUSH_OUTER_BORDER_CIRCLE_NAME = `${CanvasTool.BRUSH_NAME_PREFIX}_outer-border-circle`;

  static ERASER_NAME_PREFIX = `${CanvasTool.NAME_PREFIX}_eraser`;
  static ERASER_GROUP_NAME = `${CanvasTool.ERASER_NAME_PREFIX}_group`;
  static ERASER_FILL_CIRCLE_NAME = `${CanvasTool.ERASER_NAME_PREFIX}_fill-circle`;
  static ERASER_INNER_BORDER_CIRCLE_NAME = `${CanvasTool.ERASER_NAME_PREFIX}_inner-border-circle`;
  static ERASER_OUTER_BORDER_CIRCLE_NAME = `${CanvasTool.ERASER_NAME_PREFIX}_outer-border-circle`;

  manager: CanvasManager;
  konva: {
    group: Konva.Group;
    brush: {
      group: Konva.Group;
      fillCircle: Konva.Circle;
      innerBorderCircle: Konva.Circle;
      outerBorderCircle: Konva.Circle;
    };
    eraser: {
      group: Konva.Group;
      fillCircle: Konva.Circle;
      innerBorderCircle: Konva.Circle;
      outerBorderCircle: Konva.Circle;
    };
  };

  /**
   * A set of subscriptions that should be cleaned up when the transformer is destroyed.
   */
  subscriptions: Set<() => void> = new Set();

  constructor(manager: CanvasManager) {
    this.manager = manager;
    this.konva = {
      group: new Konva.Group({ name: CanvasTool.GROUP_NAME }),
      brush: {
        group: new Konva.Group({ name: CanvasTool.BRUSH_GROUP_NAME }),
        fillCircle: new Konva.Circle({
          name: CanvasTool.BRUSH_FILL_CIRCLE_NAME,
          listening: false,
          strokeEnabled: false,
        }),
        innerBorderCircle: new Konva.Circle({
          name: CanvasTool.BRUSH_INNER_BORDER_CIRCLE_NAME,
          listening: false,
          stroke: BRUSH_BORDER_INNER_COLOR,
          strokeWidth: BRUSH_ERASER_BORDER_WIDTH,
          strokeEnabled: true,
        }),
        outerBorderCircle: new Konva.Circle({
          name: CanvasTool.BRUSH_OUTER_BORDER_CIRCLE_NAME,
          listening: false,
          stroke: BRUSH_BORDER_OUTER_COLOR,
          strokeWidth: BRUSH_ERASER_BORDER_WIDTH,
          strokeEnabled: true,
        }),
      },
      eraser: {
        group: new Konva.Group({ name: CanvasTool.ERASER_GROUP_NAME }),
        fillCircle: new Konva.Circle({
          name: CanvasTool.ERASER_FILL_CIRCLE_NAME,
          listening: false,
          strokeEnabled: false,
          fill: 'white',
          globalCompositeOperation: 'destination-out',
        }),
        innerBorderCircle: new Konva.Circle({
          name: CanvasTool.ERASER_INNER_BORDER_CIRCLE_NAME,
          listening: false,
          stroke: BRUSH_BORDER_INNER_COLOR,
          strokeWidth: BRUSH_ERASER_BORDER_WIDTH,
          strokeEnabled: true,
        }),
        outerBorderCircle: new Konva.Circle({
          name: CanvasTool.ERASER_OUTER_BORDER_CIRCLE_NAME,
          listening: false,
          stroke: BRUSH_BORDER_OUTER_COLOR,
          strokeWidth: BRUSH_ERASER_BORDER_WIDTH,
          strokeEnabled: true,
        }),
      },
    };
    this.konva.brush.group.add(this.konva.brush.fillCircle);
    this.konva.brush.group.add(this.konva.brush.innerBorderCircle);
    this.konva.brush.group.add(this.konva.brush.outerBorderCircle);
    this.konva.group.add(this.konva.brush.group);

    this.konva.eraser.group.add(this.konva.eraser.fillCircle);
    this.konva.eraser.group.add(this.konva.eraser.innerBorderCircle);
    this.konva.eraser.group.add(this.konva.eraser.outerBorderCircle);
    this.konva.group.add(this.konva.eraser.group);

    this.subscriptions.add(
      this.manager.stateApi.$stageAttrs.listen(() => {
        this.render();
      })
    );

    this.subscriptions.add(
      this.manager.toolState.subscribe(() => {
        this.render();
      })
    );
  }

  destroy = () => {
    for (const cleanup of this.subscriptions) {
      cleanup();
    }
    this.konva.group.destroy();
  };

  scaleTool = () => {
    const toolState = this.manager.stateApi.getToolState();
    const scale = this.manager.stage.scaleX();

    const brushRadius = toolState.brush.width / 2;
    this.konva.brush.innerBorderCircle.strokeWidth(BRUSH_ERASER_BORDER_WIDTH / scale);
    this.konva.brush.outerBorderCircle.setAttrs({
      strokeWidth: BRUSH_ERASER_BORDER_WIDTH / scale,
      radius: brushRadius + BRUSH_ERASER_BORDER_WIDTH / scale,
    });

    const eraserRadius = toolState.eraser.width / 2;
    this.konva.eraser.innerBorderCircle.strokeWidth(BRUSH_ERASER_BORDER_WIDTH / scale);
    this.konva.eraser.outerBorderCircle.setAttrs({
      strokeWidth: BRUSH_ERASER_BORDER_WIDTH / scale,
      radius: eraserRadius + BRUSH_ERASER_BORDER_WIDTH / scale,
    });
  };

  render() {
    const stage = this.manager.stage;
    const renderedEntityCount: number = 1; // TODO(psyche): this.manager should be renderable entity count
    const toolState = this.manager.stateApi.getToolState();
    const selectedEntity = this.manager.getSelectedEntity();
    const cursorPos = this.manager.stateApi.$lastCursorPos.get();
    const isDrawing = this.manager.stateApi.$isDrawing.get();
    const isMouseDown = this.manager.stateApi.$isMouseDown.get();

    const tool = toolState.selected;
    const isDrawableEntity =
      selectedEntity?.state.type === 'regional_guidance' ||
      selectedEntity?.state.type === 'layer' ||
      selectedEntity?.state.type === 'inpaint_mask';

    // Update the stage's pointer style
    if (tool === 'view') {
      // View gets a hand
      stage.container().style.cursor = isMouseDown ? 'grabbing' : 'grab';
    } else if (renderedEntityCount === 0) {
      // We have no layers, so we should not render any tool
      stage.container().style.cursor = 'default';
    } else if (!isDrawableEntity) {
      // Non-drawable layers don't have tools
      stage.container().style.cursor = 'not-allowed';
    } else if (tool === 'move' || Boolean(this.manager.transformingEntity.getValue())) {
      // Move tool gets a pointer
      stage.container().style.cursor = 'default';
    } else if (tool === 'rect') {
      // Rect gets a crosshair
      stage.container().style.cursor = 'crosshair';
    } else if (tool === 'brush' || tool === 'eraser') {
      // Hide the native cursor and use the konva-rendered brush preview
      stage.container().style.cursor = 'none';
    } else if (tool === 'bbox') {
      stage.container().style.cursor = 'default';
    }

    stage.draggable(tool === 'view');

    if (!cursorPos || renderedEntityCount === 0 || !isDrawableEntity) {
      // We can bail early if the mouse isn't over the stage or there are no layers
      this.konva.group.visible(false);
    } else {
      this.konva.group.visible(true);

      // No need to render the brush preview if the cursor position or color is missing
      if (cursorPos && tool === 'brush') {
        const brushPreviewFill = this.manager.getBrushPreviewFill();
        const alignedCursorPos = alignCoordForTool(cursorPos, toolState.brush.width);
        const scale = stage.scaleX();
        // Update the fill circle
        const radius = toolState.brush.width / 2;

        this.konva.brush.fillCircle.setAttrs({
          x: alignedCursorPos.x,
          y: alignedCursorPos.y,
          radius,
          fill: isDrawing ? '' : rgbaColorToString(brushPreviewFill),
        });

        // Update the inner border of the brush preview
        this.konva.brush.innerBorderCircle.setAttrs({ x: cursorPos.x, y: cursorPos.y, radius });

        // Update the outer border of the brush preview
        this.konva.brush.outerBorderCircle.setAttrs({
          x: cursorPos.x,
          y: cursorPos.y,
          radius: radius + BRUSH_ERASER_BORDER_WIDTH / scale,
        });

        this.scaleTool();

        this.konva.brush.group.visible(true);
        this.konva.eraser.group.visible(false);
      } else if (cursorPos && tool === 'eraser') {
        const alignedCursorPos = alignCoordForTool(cursorPos, toolState.eraser.width);

        const scale = stage.scaleX();
        // Update the fill circle
        const radius = toolState.eraser.width / 2;
        this.konva.eraser.fillCircle.setAttrs({
          x: alignedCursorPos.x,
          y: alignedCursorPos.y,
          radius,
          fill: 'white',
        });

        // Update the inner border of the eraser preview
        this.konva.eraser.innerBorderCircle.setAttrs({ x: cursorPos.x, y: cursorPos.y, radius });

        // Update the outer border of the eraser preview
        this.konva.eraser.outerBorderCircle.setAttrs({
          x: cursorPos.x,
          y: cursorPos.y,
          radius: radius + BRUSH_ERASER_BORDER_WIDTH / scale,
        });

        this.scaleTool();

        this.konva.brush.group.visible(false);
        this.konva.eraser.group.visible(true);
      } else {
        this.konva.brush.group.visible(false);
        this.konva.eraser.group.visible(false);
      }
    }
  }
}
