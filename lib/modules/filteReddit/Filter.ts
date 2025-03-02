import { Class } from "utility-types";
import { pickBy } from "lodash-es";
import type { Thing } from "../../utils";
import { fastAsync, string } from "../../utils";
import type { FilterStorageValues } from "../filteReddit";
import { Case } from "./Case";
import type { Filterline } from "./Filterline";
export class Filter {
  id: string;
  name: string;
  parent: Filterline | null | undefined;
  updatePromise: Promise<any> | null | undefined;
  BaseCase: Class<Case>;
  case: Case;
  state: boolean;
  active: boolean = false;
  element: HTMLElement;
  effects: Record<string, boolean> = {};

  constructor(id: any, BaseCase: any, name: any, conditions: any = null, state: any = true, effects: any = {}) {
    this.id = id;
    this.BaseCase = BaseCase;
    this.name = name;
    this.state = state;
    // Add only active effects in order to minimize the number of effects to keep track of
    Object.assign(this.effects, pickBy(effects, Boolean));
    this.setCase(BaseCase.fromConditions(conditions));
  }

  isActive() {
    return !!this.getEffects().length && this.case.isEvaluatable();
  }

  createElement() {}

  setParent(parent: any) {
    this.parent = parent;
  }

  getStateText(state: boolean = this.state, cased: Case = this.case): string {
    return state !== false ? this.name || cased.trueText || (this.BaseCase.text || this.BaseCase.type).toLowerCase() : this.name && `¬ ${this.name}` || cased.falseText || `¬ ${this.getStateText(true, cased)}`;
  }

  getSaveValues() {
    const values: FilterStorageValues = {
      type: this.BaseCase.type,
      state: this.state,
      effects: this.effects
    };

    if (this.BaseCase.variant === 'basic') {
      values.conditions = this.case.conditions;

      if (this.name && this.name !== this.case.trueText) {
        values.name = this.name;
      }
    }

    return values;
  }

  remove() {
    for (const effect of Object.keys(this.effects)) this.effects[effect] = false;

    if (this.parent) this.parent.removeFilter(this);
  }

  getEffects(): Array<string> {
    return Object.entries(this.effects).filter(([, enabled]) => enabled).map(([name]) => name);
  }

  setCase(newCase: Case) {
    this.case = newCase;
    this.active = this.isActive(); // XXX Make sure to update this anytime effects or case changes

    if (this.active) this.case.observe(this);
  }

  update(state: boolean = this.state, conditions?: any, effects: any = {}, describeOnly: boolean = false) {
    const cased = conditions === undefined ? this.case : this.BaseCase.fromConditions(conditions, true);
    if (!cased.isValid()) throw new Error('Invalid conditions');

    if (describeOnly) {
      return `Show only posts which matches "${this.getStateText(state, cased)}"`;
    }

    this.state = state;
    Object.assign(this.effects, effects);
    this.setCase(cased);
    this.refresh();
    if (this.parent) this.parent.save();
  }

  refresh = (thing?: Thing) => {
    if (!this.parent) return;
    this.updatePromise = this.parent.refresh(this, thing ? [thing] : undefined);
  };

  async updateByInputConstruction({
    criterion,
    disableFilter,
    reverseActive,
    fromSelected
  }: {
    criterion?: string;
    disableFilter?: boolean;
    reverseActive?: boolean;
    fromSelected?: boolean;
  }, describeOnly?: boolean = false): Promise<string | null | undefined> {
    if (disableFilter) {
      if (describeOnly) return 'Disable filter';
      return this.update(undefined, undefined, {
        hide: false
      });
    }

    let state, conditions;

    if (fromSelected) {
      ({
        state,
        conditions
      } = await this.BaseCase.getSelectedEntryValue());
    } else {
      if (criterion) conditions = this.BaseCase.criterionToConditions(criterion);
      state = this.state;
    }

    if (reverseActive) state = !state;
    return this.update(state, conditions, {
      hide: true
    }, describeOnly);
  }

  matches = fastAsync(function* (thing: Thing) {
    try {
      const result = yield this.case.evaluate(thing);
      return result === null ? false : this.state === !result;
    } catch (e) {
      // evaluate may fail due to `downcast` etc
      return false;
    }
  });

  getMatchingEntry(thing: Thing) {
    // eslint-disable-line no-unused-vars
    return this.case.conditions;
  }

  removeEntry(entry: any, effect: string) {
    // eslint-disable-line no-unused-vars
    this.update(undefined, undefined, {
      [effect]: false
    });
  }

  async buildReasonElement(thing: Thing, effect: string) {
    const entry = await this.getMatchingEntry(thing);
    const element = string.html`
			<div class="res-thing-filter-remove-matching-entry" title="${JSON.stringify(entry, null, '  ')}">
				${effect}: ${this.getStateText(!this.state)} — click to remove matching filter entry
			</div>
		`;
    element.addEventListener('click', () => {
      this.removeEntry(entry, effect);
    });
    return element;
  }

}