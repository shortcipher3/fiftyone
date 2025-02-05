/**
 * Copyright 2017-2022, Voxel51, Inc.
 */

import { INFO_COLOR, TOLERANCE } from "../constants";
import { BaseState, Coordinates, KeypointSkeleton } from "../state";
import { distance, distanceFromLineSegment, multiply } from "../util";
import { CONTAINS, CoordinateOverlay, PointInfo, RegularLabel } from "./base";
import { t } from "./util";

interface KeypointLabel extends RegularLabel {
  points: Coordinates[];
}

export default class KeypointOverlay<
  State extends BaseState
> extends CoordinateOverlay<State, KeypointLabel> {
  constructor(field, label) {
    super(field, label);
  }

  containsPoint(state: Readonly<State>): CONTAINS {
    const result = this.getDistanceAndMaybePoint(state);
    if (result && result[0] <= state.pointRadius) {
      return CONTAINS.BORDER;
    }
    return CONTAINS.NONE;
  }

  draw(ctx: CanvasRenderingContext2D, state: Readonly<State>): void {
    const color = this.getColor(state);
    const selected = this.isSelected(state);
    ctx.lineWidth = 0;

    const skeleton = getSkeleton(this.field, state);

    const points = this.label.points.map((p, i) => {
      return state.options.pointFilter(
        this.field,
        Object.fromEntries(getAttributes(skeleton, this.label, i))
      )
        ? p
        : null;
    });

    if (skeleton && state.options.showSkeletons) {
      for (let i = 0; i < skeleton.edges.length; i++) {
        const path = skeleton.edges[i].map((index) => points[index]);
        this.strokePath(ctx, state, path, color);

        if (selected) {
          this.strokePath(ctx, state, path, INFO_COLOR, state.dashLength);
        }
      }
    }

    for (let i = 0; i < points.length; i++) {
      const point = points[i];
      if (!point) {
        continue;
      }

      ctx.fillStyle = color;
      ctx.beginPath();
      const [x, y] = t(state, ...point);
      ctx.arc(
        x,
        y,
        selected ? state.pointRadius * 2 : state.pointRadius,
        0,
        Math.PI * 2
      );
      ctx.fill();

      if (selected) {
        ctx.fillStyle = INFO_COLOR;
        ctx.beginPath();
        ctx.arc(x, y, state.pointRadius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  getMouseDistance(state: Readonly<State>): number {
    const result = this.getDistanceAndMaybePoint(state);

    if (result) return result[0];

    return Infinity;
  }

  getPointInfo(state: Readonly<State>): PointInfo<KeypointLabel> {
    const point = this.getDistanceAndMaybePoint(state)[1];
    const skeleton = getSkeleton(this.field, state);
    return {
      color: this.getColor(state),
      field: this.field,
      label: this.label,
      point:
        point !== null
          ? {
              coordinates: this.label.points[point],
              attributes: getAttributes(skeleton, this.label, point),
              index: point,
            }
          : null,
      type: "Keypoint",
    };
  }

  getPoints(): Coordinates[] {
    return getKeypointPoints([this.label]);
  }

  private getDistanceAndMaybePoint(
    state: Readonly<State>
  ): [number, number | null] | null {
    const distances: [number, number][] = [];
    let {
      config: { dimensions },
      pointRadius,
      pixelCoordinates: [x, y],
    } = state;
    pointRadius = this.isSelected(state) ? pointRadius * 2 : pointRadius;

    const skeleton = getSkeleton(this.field, state);

    const points = this.label.points.map((p, i) => {
      return state.options.pointFilter(
        this.field,
        Object.fromEntries(getAttributes(skeleton, this.label, i))
      )
        ? p
        : null;
    });

    for (let i = 0; i < points.length; i++) {
      const point = points[i];

      if (!point) {
        continue;
      }
      const d = distance(
        x,
        y,
        ...(multiply(dimensions, point) as [number, number])
      );
      if (d <= pointRadius * TOLERANCE) {
        distances.push([0, i]);
      } else {
        distances.push([d, i]);
      }
    }

    if (skeleton && state.options.showSkeletons) {
      for (let i = 0; i < skeleton.edges.length; i++) {
        const path = skeleton.edges[i].map((index) => points[index]);

        for (let j = 1; j < path.length; j++) {
          if (!path[j] || !path[j - 1]) {
            continue;
          }
          distances.push([
            distanceFromLineSegment(
              [x, y],
              multiply(dimensions, path[j - 1]),
              multiply(dimensions, path[j])
            ),
            null,
          ]);
        }
      }
    }

    if (!distances.length) {
      return null;
    }

    return distances.sort((a, b) => a[0] - b[0])[0];
  }

  private strokePath(
    ctx: CanvasRenderingContext2D,
    state: Readonly<State>,
    path: Coordinates[],
    color: string,
    dash?: number
  ) {
    ctx.beginPath();
    ctx.lineWidth = state.strokeWidth;
    ctx.strokeStyle = color;
    ctx.setLineDash(dash ? [dash] : []);

    for (let i = 1; i < path.length; i++) {
      const start = path[i - 1];
      const end = path[i];
      if (!start || !end) {
        continue;
      }
      ctx.moveTo(...t(state, ...start));
      ctx.lineTo(...t(state, ...end));
    }

    ctx.stroke();
  }
}

export const getKeypointPoints = (labels: KeypointLabel[]): Coordinates[] => {
  let points = [];
  labels.forEach((label) => {
    points = [...points, ...label.points];
  });
  return points;
};

const getSkeleton = (
  name: string,
  state: BaseState
): KeypointSkeleton | null => {
  const defaultSkeleton = state.options.defaultSkeleton;

  const namedSkeleton = state.options.skeletons
    ? state.options.skeletons[name]
    : null;

  return namedSkeleton || defaultSkeleton || null;
};

const getAttributes = (
  skeleton: KeypointSkeleton | null,
  label: KeypointLabel,
  index: number
): [string, unknown][] => {
  return Object.entries(label)
    .filter(([k, v]) => Array.isArray(v) && k !== "tags")
    .map(([k, v]) => [k, v[index]])
    .concat(skeleton ? [["label", skeleton.labels[index]]] : []) as [
    string,
    unknown
  ][];
};
