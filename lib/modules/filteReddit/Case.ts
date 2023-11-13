import { $Shape } from "utility-types";
import { escapeRegExp } from "lodash-es";
import { Thing, SelectedThing, string } from "../../utils";
import type { BuilderValue, BuilderRootValue } from "../../core/module";
import * as Cases from "./cases";
export class Case {
  static type: string;
  static text: string;
  static readonly thingToCriterion: ((thing: Thing) => string | Promise<string>) | null | undefined;
  static readonly parseCriterion: ((input: string) => any) | null | undefined;

  static async getSelectedEntryValue() {
    const selected = SelectedThing.current;
    if (!selected) throw new Error('No entry is currently selected.');
    let conditions;

    if (this.defaultConditions) {
      if (!this.thingToCriterion) throw Error('Case does not have method `thingToCriterion`');
      conditions = this.criterionToConditions(await this.thingToCriterion(selected));
    }

    const cased = this.fromConditions(conditions);
    const state = await cased.evaluate(selected);
    if (typeof state !== 'boolean') throw new Error('Could not evaluate case against selected thing');
    return {
      conditions,
      state
    };
  }

  static criterionToConditions(criterion: string): $Shape<BuilderValue> {
    const parse = this.parseCriterion && this.parseCriterion.bind(this);

    if (!parse) {
      throw new Error('Does not accept criterion');
    }

    if (!criterion && this.pattern && !this.pattern.startsWith('[')) {
      throw new Error('Requires criterion');
    }

    const parts = criterion.split(' & ');

    if (this.criterionOperators && criterion && parts.length > 1) {
      return Cases.getGroup('all', parts.map(v => Cases.getConditions(this.type, parse(v))));
    } else {
      return parse(criterion);
    }
  }

  static fromConditions(from: $Shape<BuilderValue> | null | undefined, propagateError: boolean = false): Case {
    let cased;
    const conditions = Cases.getConditions(from && from.type || this.type, from);
    const type = conditions.type;

    try {
      const CaseClass = Cases.get(type);
      if (CaseClass.disabled) throw new Error(`${CaseClass.type} is disabled`);
      cased = new CaseClass(conditions);
    } catch (e) {
      if (propagateError) throw e;
      console.error(`Could not build case: ${e.message}. Ignoring.`, e);
      cased = new Cases.Inert(conditions);
    }

    return cased;
  }

  static buildRegex(val: string, {
    fullMatch = true
  }: {
    fullMatch?: boolean;
  } = {}) {
    if (!val) throw new Error('Pattern cannot be empty');

    if (string.regexRegex.test(val)) {
      const [, str, flags] = (string.regexRegex.exec(val) as any); // guaranteed to match due to `.test()` above

      return new RegExp(str, flags);
    } else {
      const patt = escapeRegExp(val);
      return new RegExp(fullMatch ? `^${patt}$` : patt, 'i');
    }
  }

  static readonly defaultConditions: $Shape<BuilderValue> | null | undefined;
  static fields: any;
  static slow: number = 0; // Estimated slowness of case; higher value → slower

  static readonly reconcile: (arg0: Array<any> | null | undefined) => any;

  static get disabled(): boolean {
    return false;
  }

  // Determines where cases are available; usually set by Cases.populate
  static contexts: Array<"browse" | "post" | "comment">;

  static validate(conditions: BuilderValue) {
    const cased = Case.fromConditions(conditions, true);
    if (!cased.isValid()) throw new Error('Invalid conditions');
    return true;
  }

  // For Filterline
  static unique: boolean = false;
  static variant: "basic" | "ondemand" | "external" = 'basic';
  static pattern: string = '';
  static criterionOperators = false; // Create groups on encountering operators: ' & ' → 'and'

  static _customFilter: BuilderRootValue | null | undefined;

  static getCustomFilter() {
    if (this._customFilter) return this._customFilter;
    throw new Error('Source not found');
  }

  readonly trueText: string | null | undefined;
  readonly falseText: string | null | undefined;

  constructor(conditions: any) {
    this.conditions = this.value = conditions;
  }

  isValid(): boolean {
    return true;
  }

  isEvaluatable() {
    return !(this instanceof Cases.Inert || this.constructor.disabled);
  }

  hasType(type: string): boolean {
    return this.constructor.type === type;
  }

  conditions: BuilderValue;
  value: any;

  evaluate(thing: Thing | null | undefined, values: any[] | null | undefined): null | boolean | Promise<null | boolean> {
    // eslint-disable-line no-unused-vars
    throw new Error('evaluate() must be implemented for all Case subclasses');
  }

  observers: Set<{
    refresh: (thing?: Thing) => void;
  }> = new Set();

  onObserve(): boolean | null | undefined {} // `true` → `refresh` callback registered


  observe(observer: any): boolean | null | undefined {
    // `true` → observer added
    if (!this.observers.has(observer) && this.onObserve()) {
      this.observers.add(observer);
      return true;
    }
  }

  refresh(thing?: Thing) {
    for (const o of this.observers) o.refresh(thing);
  }

}
export class PatternCase extends Case {
  static parseCriterion(input: any) {
    return {
      patt: input
    };
  }

  static defaultConditions = {
    patt: ''
  };
  static pattern = 'RegEx';

  static reconcile(values: any) {
    // Variants may have differening conditions other than just `patt`
    // Group only values with equal (non-`patt`) conditions together
    const variants = [];

    for (const v of values) {
      let variant;

      variantLoop: // eslint-disable-line no-labels
      for (const possibleVariant of variants) {
        for (const key of Object.keys(v)) {
          if (key === 'patt') continue;
          if (possibleVariant[key] !== v[key]) continue variantLoop; // eslint-disable-line no-labels
        }

        variant = possibleVariant;
        break;
      }

      if (!variant) {
        variant = { ...v,
          patt: []
        };
        variants.push(variant);
      }

      variant.patt.push(v.patt);
    }

    return variants;
  }

  build(fullMatchDefault: boolean, pattIfEmpty?: string): Array<RegExp> {
    const {
      patt,
      fullMatch = fullMatchDefault
    } = this.conditions;
    const raw = Array.isArray(patt) ? patt : [patt];
    const plain = new Set();
    const variants = {};

    for (let _patt of raw) {
      if (!_patt) {
        if (typeof pattIfEmpty === 'string') _patt = pattIfEmpty;else if (raw.length === 1) throw new Error('Pattern cannot be empty');else continue;
      }

      if (string.regexRegex.test(_patt)) {
        const [, str, flags = ''] = (string.regexRegex.exec(_patt) as any); // guaranteed to match due to `.test()` above

        if (!variants[flags]) variants[flags] = [];
        variants[flags].push(str);
      } else {
        plain.add(escapeRegExp(_patt));
      }
    }

    if (plain.size) {
      const str = Array.from(plain).join('|');
      if (!variants.i) variants.i = [];
      variants.i.push(fullMatch ? `^(${str})$` : str);
    }

    return Object.entries(variants).map<any>(([flags, sources]) => new RegExp(sources.join('|'), flags));
  }

}