import { selectorFamily } from "recoil";

import * as utils from "./utils";
import * as booleanField from "./BooleanFieldFilter.state";
import * as numericField from "./NumericFieldFilter.state";
import * as stringField from "./StringFieldFilter.state";
import * as atoms from "../../recoil/atoms";
import * as filterAtoms from "./atoms";
import * as selectors from "../../recoil/selectors";
import { LABEL_LIST, VALID_LIST_TYPES } from "../../utils/labels";
import { KEYPOINT, KEYPOINTS } from "@fiftyone/looker/src/constants";
import { NONFINITE } from "@fiftyone/looker/src/state";

interface Label {
  confidence?: number;
  label?: number;
}

export type LabelFilters = {
  [key: string]: (
    label: Label
  ) => boolean | ((value: string | number | boolean) => boolean);
};

export const getPathExtension = (type: string): string => {
  if (VALID_LIST_TYPES.includes(type)) {
    return `.${LABEL_LIST[type]}`;
  }
  return "";
};

interface Point {
  points: [number | NONFINITE, number | NONFINITE];
  label: string;
  [key: string]: any;
}

export const skeletonFilter = selectorFamily<
  (path: string, value: Point) => boolean,
  boolean
>({
  key: "skeletonFilter",
  get: (modal) => ({ get }) => {
    const filters = get(
      modal ? filterAtoms.modalFilterStages : filterAtoms.filterStages
    );
    const types = get(selectors.labelTypesMap);

    return (path: string, point: Point) => {
      const lpath = `${path}${getPathExtension(types[path])}.points.label`;
      const cpath = `${path}${getPathExtension(types[path])}.confidence`;

      if (point.points.some((c) => c === "nan")) {
        return false;
      }

      if (!filters[lpath] && !filters[cpath]) {
        return true;
      }
      const l = filters[lpath];

      const label =
        !l ||
        (l.exclude
          ? !l.values.includes(point.label)
          : l.values.includes(point.label));

      const c = filters[cpath];

      if (!c) {
        return label;
      }

      const inRange = c.exclude
        ? c.range[0] - 0.005 > point.confidence ||
          point.confidence > c.range[1] + 0.005
        : c.range[0] - 0.005 <= point.confidence &&
          point.confidence <= c.range[1] + 0.005;
      const noConfidence = c.none && point.confidence === undefined;

      return (
        label &&
        (inRange ||
          noConfidence ||
          (c.nan && point.confidence === "nan") ||
          (c.inf && point.confidence === "inf") ||
          (c.ninf && point.confidence === "-inf"))
      );
    };
  },
});

export const labelFilters = selectorFamily<LabelFilters, boolean>({
  key: "labelFilters",
  get: (modal) => ({ get }) => {
    const labels = get(modal ? utils.activeModalFields : utils.activeFields);
    const filters = {};
    const typeMap = get(selectors.labelTypesMap);
    const hiddenLabels = modal ? get(atoms.hiddenLabels) : null;

    const primitives = get(selectors.primitiveNames("sample"));
    for (const field of labels) {
      if (primitives.includes(field)) {
        if (get(numericField.isNumericField(field))) {
          let [range, none, inf, ninf, nan, exclude] = [
            get(numericField.rangeAtom({ modal, path: field })),
            get(numericField.otherAtom({ modal, path: field, key: "none" })),
            get(numericField.otherAtom({ modal, path: field, key: "inf" })),
            get(numericField.otherAtom({ modal, path: field, key: "ninf" })),
            get(numericField.otherAtom({ modal, path: field, key: "nan" })),
            get(numericField.excludeAtom({ modal, path: field })),
          ];

          if (exclude) {
            none = !none;
            inf = !inf;
            ninf = !ninf;
            nan = !nan;
          }

          filters[field] = (value) => {
            const inRange = exclude
              ? range[0] - 0.005 > value || value > range[1] + 0.005
              : range[0] - 0.005 <= value && value <= range[1] + 0.005;
            const noNone = none && value === undefined;
            return (
              inRange ||
              noNone ||
              (inf && value === "inf") ||
              (nan && value === "nan") ||
              (ninf && value === "-inf")
            );
          };
        } else if (get(stringField.isStringField(field))) {
          const [values, exclude] = [
            get(stringField.selectedValuesAtom({ modal, path: field })),
            get(stringField.excludeAtom({ modal, path: field })),
          ];

          filters[field] = (value) => {
            let included = values.includes(value);
            if (exclude) {
              included = !included;
            }

            return included || values.length === 0;
          };
        } else if (get(booleanField.isBooleanField(field))) {
          const [trueValue, falseValue, noneValue] = [
            get(booleanField.trueAtom({ modal, path: field })),
            get(booleanField.falseAtom({ modal, path: field })),
            get(booleanField.noneAtom({ modal, path: field })),
          ];

          if (!trueValue && !falseValue && !noneValue) {
            filters[field] = (value) => true;
          } else {
            filters[field] = (value) => {
              if (value === true && trueValue) {
                return true;
              }

              if (value === false && falseValue) {
                return true;
              }

              if (value === null && noneValue) {
                return true;
              }

              return false;
            };
          }
        }
        continue;
      }

      const path = `${field}${getPathExtension(typeMap[field])}`;

      const cPath = `${path}.confidence`;
      const lPath = `${path}.label`;
      const vPath = `${path}.value`;

      let [
        cRange,
        cNone,
        cInf,
        cNinf,
        cNan,
        cExclude,
        lValues,
        lExclude,
        vRange,
        vNone,
        vInf,
        vNinf,
        vNan,
        vExclude,
      ] = [
        get(
          numericField.rangeAtom({ modal, path: cPath, defaultRange: [0, 1] })
        ),
        get(
          numericField.otherAtom({
            modal,
            path: cPath,
            defaultRange: [0, 1],
            key: "none",
          })
        ),
        get(
          numericField.otherAtom({
            modal,
            path: cPath,
            defaultRange: [0, 1],
            key: "inf",
          })
        ),
        get(
          numericField.otherAtom({
            modal,
            path: cPath,
            defaultRange: [0, 1],
            key: "ninf",
          })
        ),
        get(
          numericField.otherAtom({
            modal,
            path: cPath,
            defaultRange: [0, 1],
            key: "nan",
          })
        ),
        get(
          numericField.excludeAtom({
            modal,
            path: cPath,
            defaultRange: [0, 1],
          })
        ),
        get(stringField.selectedValuesAtom({ modal, path: lPath })),
        get(stringField.excludeAtom({ modal, path: lPath })),
        get(numericField.rangeAtom({ modal, path: vPath })),
        get(
          numericField.otherAtom({
            modal,
            path: vPath,
            key: "none",
          })
        ),
        get(
          numericField.otherAtom({
            modal,
            path: vPath,
            key: "inf",
          })
        ),
        get(
          numericField.otherAtom({
            modal,
            path: vPath,
            key: "ninf",
          })
        ),
        get(
          numericField.otherAtom({
            modal,
            path: vPath,
            key: "nan",
          })
        ),
        get(
          numericField.excludeAtom({
            modal,
            path: vPath,
          })
        ),
      ];

      if (cExclude) {
        cNone = !cNone;
        cInf = !cInf;
        cNinf = !cNinf;
        cNan = !cNan;
      }

      if (vExclude) {
        vNone = !vNone;
        vInf = !vInf;
        vNinf = !vNinf;
        vNan = !vNan;
      }

      const matchedTags = get(filterAtoms.matchedTags({ key: "label", modal }));

      filters[field] = (s) => {
        if (hiddenLabels && hiddenLabels[s.id ?? s._id]) {
          return false;
        }

        const inRange = cExclude
          ? cRange[0] - 0.005 > s.confidence || s.confidence > cRange[1] + 0.005
          : cRange[0] - 0.005 <= s.confidence &&
            s.confidence <= cRange[1] + 0.005;
        const noConfidence =
          (cNone && s.confidence === undefined) ||
          [KEYPOINTS, KEYPOINT].includes(typeMap[field]);
        let label = s.label ? s.label : s.value;
        if (label === undefined) {
          label = null;
        }
        let included = lValues.includes(label);
        if (lExclude) {
          included = !included;
        }

        const meetsTags =
          matchedTags.size == 0 ||
          (s.tags && s.tags.some((t) => matchedTags.has(t)));

        const inValueRange = vExclude
          ? vRange[0] - 0.005 > s.value || s.value > vRange[1] + 0.005
          : vRange[0] - 0.005 <= s.value && s.value <= vRange[1] + 0.005;
        const noValue = vNone && s.value === undefined;

        return (
          (inRange ||
            noConfidence ||
            Array.isArray(s.confidence) ||
            (cNan && s.confidence === "nan") ||
            (cInf && s.confidence === "inf") ||
            (cNinf && s.confidence === "-inf")) &&
          (included || lValues.length === 0) &&
          meetsTags &&
          (inValueRange ||
            noValue ||
            (vNan && s.value === "nan") ||
            (vInf && s.value === "inf") ||
            (vNinf && s.value === "-inf"))
        );
      };
    }
    return filters;
  },
  set: () => ({ get, set, reset }, _) => {
    set(utils.activeModalFields, get(utils.activeFields));
    set(atoms.cropToContent(true), get(atoms.cropToContent(false)));
    set(filterAtoms.modalFilterStages, get(filterAtoms.filterStages));
    reset(selectors.appConfigOption({ modal: true, key: "color_by_value" }));
    reset(selectors.appConfigOption({ modal: true, key: "show_skeletons" }));
    set(atoms.colorSeed(true), get(atoms.colorSeed(false)));
    set(atoms.sortFilterResults(true), get(atoms.sortFilterResults(false)));
    set(atoms.alpha(true), get(atoms.alpha(false)));
  },
});
3;

export const fieldIsFiltered = selectorFamily<
  boolean,
  { path: string; modal: boolean }
>({
  key: "fieldIsFiltered",
  get: ({ path, modal }) => ({ get }) => {
    const isArgs = { path, modal };
    if (get(booleanField.isBooleanField(path))) {
      return get(booleanField.fieldIsFiltered(isArgs));
    } else if (get(numericField.isNumericField(path))) {
      return get(numericField.fieldIsFiltered(isArgs));
    } else if (get(stringField.isStringField(path))) {
      return get(stringField.fieldIsFiltered(isArgs));
    }
    if (path.startsWith("_label_tags.")) {
      return get(filterAtoms.matchedTags({ modal, key: "label" })).has(
        path.slice("_label_tags.".length)
      );
    }

    if (path.startsWith("tags.")) {
      return get(filterAtoms.matchedTags({ modal, key: "sample" })).has(
        path.slice("tags.".length)
      );
    }

    path = `${path}${getPathExtension(get(selectors.labelTypesMap)[path])}`;
    const cPath = `${path}.confidence`;
    const lPath = `${path}.label`;
    const vPath = `${path}.value`;
    const hasHiddenLabels = modal
      ? get(selectors.hiddenFieldLabels(path.split(".")[0])).length > 0
      : false;

    return (
      get(
        numericField.fieldIsFiltered({
          ...isArgs,
          path: cPath,
          defaultRange: [0, 1],
        })
      ) ||
      get(stringField.fieldIsFiltered({ ...isArgs, path: lPath })) ||
      get(
        numericField.fieldIsFiltered({
          ...isArgs,
          path: vPath,
        })
      ) ||
      hasHiddenLabels
    );
  },
});

export const isLabelField = selectorFamily<boolean, string>({
  key: "isLabelField",
  get: (field) => ({ get }) => {
    const names = get(selectors.labelNames("sample")).concat(
      get(selectors.labelNames("frame")).map((l) => "frames." + l)
    );
    return names.includes(field);
  },
});
