import { Class, $Shape } from "utility-types";
import $ from "jquery";
import { debounce, pull, intersection, difference, without, groupBy, sortBy } from "lodash-es";
import type { Thing } from "../../utils";
import { BodyClasses, SelectedThing, fastAsync, waitForEvent, downcast, hide as redditHide, unhide as redditUnhide, frameThrottle, forEachChunked, idleThrottle, loggedInUser, keyedMutex, filterMap, string } from "../../utils";
import { i18n } from "../../environment";
import * as Hover from "../hover";
import * as Notifications from "../notifications";
import * as FilteReddit from "../filteReddit";
import * as RESTips from "../RESTips";
import * as Cases from "./cases";
import { ExternalFilter } from "./ExternalFilter";
import { LineFilter } from "./LineFilter";
import type { Filter } from "./Filter";
import type { Case } from "./Case";
type NewFilterOpts = FilteReddit.FilterStorageValues & {
  Filter?: Class<Filter>;
  id?: string;
  add?: boolean;
  save?: boolean;
};
export class Filterline {
  things: Set<Thing> = new Set();
  thingType: string;
  storage: any;
  filters: Filter[] = [];
  sortedFilters: Filter[] = []; // Filters sorted by slowness

  currentMatches: Map<Thing, Record<string, Filter | null>> = new Map();
  permanentlyHiddenThings: Set<Thing> = new Set();
  displayReasons: boolean = false;
  element: HTMLElement;
  dropdown: HTMLElement;
  preamble: HTMLElement;
  filterContainer: HTMLElement;
  poweredElement: HTMLInputElement;
  permanentlyHideCheckbox: HTMLInputElement;
  initialized: boolean = false;

  constructor(storage: any, thingType: any) {
    this.storage = storage;
    this.thingType = thingType;
  }

  // Initialize once things are being processed
  isInitialized(): boolean {
    if (this.initialized) return true;
    if (!this.things.size || !this.getActiveFilters().length) return false;
    this.initialized = true;
    // It is possible to optimize the order of filters until things are filtered
    // if order is changed thereafter, `getFiltersToTest` may return invalid results
    this.sortedFilters = sortBy(this.filters, ({
      case: {
        constructor: {
          slow
        }
      }
    }) => slow);

    if (this.thingType === 'post') {
      // Improve performance by not evaluating these effects on post filters
      // TODO Move this closer to the effect list
      delete this.availableEffects.collapse;
      delete this.availableEffects.propagate;
    }

    return true;
  }

  isPowered() {
    return !document.documentElement.classList.contains('res-filters-disabled');
  }

  togglePowered = (powered: boolean = !this.isPowered()) => {
    BodyClasses.toggle(!powered, 'res-filters-disabled');
    this.poweredElement.checked = powered;
  };

  createElement() {
    const element = this.element = string.html`
			<div class="res-filterline">
				<div class="res-filterline-preamble"></div>
				<div class="res-filterline-filters">
					<input type="checkbox" ${this.isPowered() && 'checked'} class="res-filterline-toggle-powered" title="Stop filtering temporarily"></input>
				</div>
			</div>
		`;
    this.preamble = element.querySelector('.res-filterline-preamble');
    this.filterContainer = element.querySelector('.res-filterline-filters');
    this.addFilterElements(this.filters);
    waitForEvent(this.preamble, 'mouseenter', 'click').then(() => this.createDropdown());
    this.poweredElement = downcast(element.querySelector('.res-filterline-toggle-powered'), HTMLInputElement);
    this.poweredElement.addEventListener('change', () => {
      this.togglePowered();
    });
  }

  addFilterElements(filters: Filter[]) {
    for (const filter of filters) {
      if (filter instanceof ExternalFilter) continue; // ExternalFilter elements are created when dropdown is bulit

      filter.createElement();
      this.filterContainer.appendChild(filter.element);
    }
  }

  getFiltersOfCase(CaseClass: any) {
    return this.filters.filter(v => v.BaseCase === CaseClass);
  }

  getPickable(): Class<Case>[] {
    return Object.values(Cases.getByContext(this.thingType, false)).filter(v => !v.disabled && v.variant !== 'external');
  }

  createDropdown() {
    const element = string.html`
			<div class="res-filterline-dropdown">
				<div class="res-filterline-dropdown-other"></div>
				<div class="res-filterline-dropdown-toggles">
					<div class="res-filterline-display-match-reason">
						<label>
							<input type="checkbox" ${this.displayReasons && 'checked'}">
							<span>Show matching filters</span>
						</label>
					</div>
				</div>
				<div class="res-filterline-show-help">
					Usage information
				</div>
			</div>
		`;
    this.preamble.append(element);
    // Hover cards may be in front of the dropdown
    this.preamble.addEventListener('mouseenter', () => {
      Hover.infocard('filterline-filter').close();
    });

    function addDetails(summary, className: string, ...elements) {
      const e = string.html`<details class="${className}"><summary>${summary}</summary></details>`;
      e.append(...elements);
      element.querySelector('.res-filterline-dropdown-other').append(e);
    }

    addDetails('Modify external filters', 'res-filterline-external', ...this.filters.filter(filter => filter instanceof ExternalFilter).map(filter => {
      filter.createElement();
      return filter.element;
    }));
    // `Cases.Group` is separated
    const dp = groupBy(without(this.getPickable(), Cases.Group), v => v.variant);

    for (const [name, CaseClasses] of Object.entries(dp)) {
      addDetails(`New ${name} filter`, `res-filterline-new-${name}`, ...CaseClasses.sort((a, b) => a.type.localeCompare(b.type)).map(CaseClass => this.createNewFilterElement(CaseClass)));
    }

    const _getAsConditions = this.getAsConditions.bind(this);

    addDetails('New complex filter', 'res-filterline-new-group', this.createNewFilterElement(Cases.Group, 'Copy active filters', {
      get conditions() {
        return _getAsConditions();
      }

    }), ...Cases.Group.fields[0].options.map(op => this.createNewFilterElement(Cases.Group, `Matches ${op}`, {
      conditions: {
        op,
        of: []
      }
    })));
    addDetails('Use as default', 'res-filterline-set-default', ...FilteReddit.defaultFilters.map(({
      type,
      text
    }) => {
      const e = string.html`<div class="res-filterline-dropdown-action">${text}</div>`;
      e.addEventListener('click', () => FilteReddit.saveFilterlineStateAsDefault(type));
      return e;
    }), (() => {
      const e = string.html`<div class="res-filterline-dropdown-action">Reset this Filterline</div>`;
      e.addEventListener('click', () => {
        this.storage.delete();
        if (confirm('Reload page to restore default')) location.reload();
      });
      return e;
    })());
    const displayReasonsCheckbox = downcast(element.querySelector('.res-filterline-display-match-reason input'), HTMLInputElement);
    displayReasonsCheckbox.addEventListener('change', () => {
      this.toggleDisplayReasons(displayReasonsCheckbox.checked);
    });

    if (this.thingType === 'post' && loggedInUser()) {
      const permanentlyHide = string.html`
				<div class="res-filterline-permanently-hide">
					<label>
						<input type="checkbox">
						<span>Permanently hide</span>
					</label>
				</div>
			`;
      const checkbox = this.permanentlyHideCheckbox = downcast(permanentlyHide.querySelector('input'), HTMLInputElement);
      this.updatePermanentlyHideCheckbox();
      permanentlyHide.addEventListener('click', async () => {
        checkbox.disabled = true;
        await (this.permanentlyHiddenThings.size ? this.unhidePermanently() : this.hidePermanently());
        checkbox.disabled = false;
      });
      element.querySelector('.res-filterline-dropdown-toggles').append(permanentlyHide);
    }

    downcast(element.querySelector('.res-filterline-show-help'), HTMLElement).addEventListener('click', () => {
      RESTips.showFeatureTip('filterlineVisible');
    });
  }

  updatePermanentlyHideCheckbox() {
    if (!this.permanentlyHideCheckbox) return;
    this.permanentlyHideCheckbox.checked = this.permanentlyHideCheckbox.indeterminate = false;
    if (!this.permanentlyHiddenThings.size) return;
    if (this.getThings('hide').length === this.permanentlyHiddenThings.size) this.permanentlyHideCheckbox.checked = true;else this.permanentlyHideCheckbox.indeterminate = true;
  }

  createNewFilterElement(CaseClass: Class<Case>, text: string = CaseClass.text, newOpts?: $Shape<NewFilterOpts>) {
    let fromSelected = false;
    const element = string.html`<div class="res-filterline-dropdown-action res-filterline-filter-new" type="${CaseClass.type}">${text}</div>`;
    element.addEventListener('click', () => {
      const existing = CaseClass.unique && this.getFiltersOfCase(CaseClass)[0];
      let filter;

      if (existing) {
        if (!(existing instanceof LineFilter)) throw new Error();
        filter = existing;
      } else {
        filter = downcast(this.createFilter({
          type: CaseClass.type,
          add: true,
          ...newOpts
        }), LineFilter);
      }

      if (fromSelected) filter.updateByInputConstruction({
        fromSelected
      });else filter.showInfocard(true);
    });

    if (CaseClass.thingToCriterion || !CaseClass.defaultConditions) {
      const c = string.html`<div class="res-filterline-filter-new-from-selected" title="From selected entry"></div>`;
      c.addEventListener('click', () => {
        fromSelected = true;
        setTimeout(() => {
          fromSelected = false;
        });
      });
      element.append(c);
    }

    return element;
  }

  async hidePermanently(things: Array<Thing> = this.getThings('hide')) {
    await Promise.all(difference(things, Array.from(this.permanentlyHiddenThings)).map(thing => redditHide(thing)));

    for (const v of things) this.permanentlyHiddenThings.add(v);

    this.updatePermanentlyHideCheckbox();
    Notifications.showNotification({
      moduleID: FilteReddit.module.moduleID,
      notificationID: 'hideThings',
      message: string.html`<div><p>Reddit has now hidden ${things.length} things. Undo by unchecking the checkbox in the menu.</p><p><a href="/user/me/hidden/">See all hidden posts</a></p>`
    });
  }

  async unhidePermanently(things: Array<Thing> = [...this.permanentlyHiddenThings]) {
    await Promise.all(intersection(things, Array.from(this.permanentlyHiddenThings)).map(thing => redditUnhide(thing)));

    for (const v of things) this.permanentlyHiddenThings.delete(v);

    this.updatePermanentlyHideCheckbox();
    Notifications.showNotification({
      moduleID: FilteReddit.module.moduleID,
      notificationID: 'unhideThings',
      message: `${things.length} things are no longer hidden.`
    });
  }

  getAsConditions(hasEffect: string = 'hide'): any {
    const extracted = filterMap(this.filters, v => v.effects[hasEffect] && v instanceof LineFilter && [v] || undefined);
    return Cases.resolveGroup(Cases.getGroup('all', extracted.map(v => v.state ? v.case.conditions : Cases.getGroup('none', [v.case.conditions]))), false, true);
  }

  deferredFilters: Record<string, any> = {};

  resumeDeferredTypes(types: Array<string>) {
    Object.entries(this.deferredFilters).filter(([, {
      type
    }]) => types.includes(type)).forEach(([id]) => this.createFilterFromStateValues(id));
  }

  restoreState(filters: any) {
    for (const [id, opts] of Object.entries(filters)) {
      try {
        if (opts.type === 'inert') throw new Error('Requested inert filter. This state is likely due to a bug. Ignoring.');
        const filter = this.getFilter(id);
        if (filter) throw new Error(`Filter with id ${id} already exists`);
        const CaseClass = Cases.has(opts.type) && Cases.get(opts.type);

        if (CaseClass && !CaseClass.disabled && // External filter are created directly
        CaseClass.variant !== 'external') {
          this.createFilterFromStateValues(id, opts);
        } else {
          this.deferredFilters[id] = opts;
        }
      } catch (e) {
        console.error('Could not create filter', id, opts);
        this.storage.deletePath('filters', id);
      }
    }
  }

  createFilterFromStateValues(id: any, opts: any) {
    const deferredOpts = this.deferredFilters[id];
    delete this.deferredFilters[id];
    return this.createFilter({
      id,
      ...opts,
      ...deferredOpts,
      add: true,
      save: false
    });
  }

  save = idleThrottle(async () => {
    const filters = this.filters.reduce((acc, v) => {
      acc[v.id] = v.getSaveValues();
      return acc;
    }, { ...this.deferredFilters
    });
    await this.storage.deletePath('filters');
    await this.storage.patch({
      filters,
      lastUsed: Date.now()
    });
  });

  getCLI(): any {
    const deconstruct = val => {
      // Example: "!expando image" → { reverseActive: true, key: "expando", criterion: "image" }
      const [, modifiers, key, criterion]: string[] = (val.match(/^([^\w]*)(\w*)(.*)/) as any); // guaranteed match

      return {
        key,
        criterion: criterion.trim(),
        disableFilter: !!modifiers.match('/'),
        reverseActive: !!modifiers.match('!'),
        asNewFilter: !!modifiers.match('\\+'),
        fromSelected: !!modifiers.match('=')
      };
    };

    const findMatchingCases = val => this.getPickable().sort((a, b) => a.variant.localeCompare(b.variant) || a.type.localeCompare(b.type)).map(CaseClass => ({
      // on-demand cases' type name are hard to discern
      name: CaseClass.variant === 'ondemand' ? CaseClass.text : CaseClass.type,
      cls: CaseClass
    })).filter(({
      name
    }) => name.toLowerCase().match(val.toLowerCase()));

    let filter;

    async function getTip(val) {
      const deconstructed = deconstruct(val);
      const {
        key,
        asNewFilter
      } = deconstructed;
      const bestMatch = key && sortBy(findMatchingCases(key), ({
        name
      }) => name.toLowerCase().indexOf(key.toLowerCase()))[0];
      const {
        cls: MatchedCase
      } = bestMatch || {};
      let message;

      if (bestMatch) {
        try {
          const lastFilter = this.getFiltersOfCase(MatchedCase).slice(-1)[0];
          filter = lastFilter && !asNewFilter ? lastFilter : this.createFilter({
            type: MatchedCase.type
          });
          const actionDescription = await filter.updateByInputConstruction(deconstructed, true);

          /*:: if (!actionDescription ) throw new Error(); */
          message = `${filter.parent ? `Modify "${filter.getStateText(filter.state)}"` : 'New filter'}: ${actionDescription}`;
        } catch (e) {
          message = `Error: ${e.message}`;
        }
      } else {
        filter = null;
        message = 'No filter selected.';
      }

      return ['<pre>', 'Syntax: [modifiers] filterName [criterion]', '', message, '', 'Filters:', ...findMatchingCases('').map(v => ` ${MatchedCase === v.cls ? `<b>${v.name}</b>` : v.name} ${v.cls.pattern}`), '', 'Modifiers:', ' / — disable the filter', ' ! — reverse the active state', ' + — create as new filter', ' = — use the currently selected post\'s data as criterion', '', 'Examples:', ' =postAfter   → filter posts older than selected', ' +=!postAfter → new filter, filter posts younger than selected', '</pre>'].join('\n');
    }

    function executeCommand(val) {
      if (!filter) return;
      if (!filter.parent) this.addFilter(filter);
      filter.updateByInputConstruction(deconstruct(val));
      filter = null;
    }

    return {
      getTip: getTip.bind(this),
      executeCommand: executeCommand.bind(this)
    };
  }

  createFilter(opts: $Shape<NewFilterOpts>) {
    const {
      Filter = LineFilter,
      id = `~${performance.timing.navigationStart + performance.now()}`,
      // timestamp, so that filters will restored in the same order as they initially were created
      add = false,
      save = true,
      type,
      criterion,
      effects,
      name,
      state
    } = opts;
    let {
      conditions
    } = opts;
    if (this.deferredFilters.hasOwnProperty(id)) return this.createFilterFromStateValues(id, opts);
    const CaseClass = Cases.get(type);

    if (CaseClass.unique) {
      const [existing] = this.getFiltersOfCase(CaseClass);
      if (existing) return existing;
    }

    if (!conditions && criterion) {
      // Legacy; `criterion` is no longer saved to storage
      conditions = CaseClass.criterionToConditions(criterion);
    }

    const filter = new Filter(id, CaseClass, name, conditions, state, effects);

    if (add) {
      this.addFilter(filter);
      if (save) this.save();
    }

    return filter;
  }

  addFilter(filter: Filter) {
    filter.setParent(this);
    this.filters.push(filter);

    if (this.isInitialized()) {
      this.sortedFilters.push(filter);
      this.refresh(filter);
    }

    if (this.filterContainer) this.addFilterElements([filter]);
  }

  async removeFilter(filter: Filter) {
    if (filter.element) filter.element.remove();
    if (this.isInitialized()) await this.refresh(filter);
    pull(this.filters, filter);
    pull(this.sortedFilters, filter);
    this.save();
  }

  getFilter(id: string): Filter | null | undefined {
    return this.filters.find(filter => filter.id === id);
  }

  getActiveFilters() {
    return this.filters.filter(v => v.active);
  }

  availableEffects: Record<string, (arg0: Thing, arg1: Filter) => void> = {
    propagate: (thing, match) => {
      thing.element.classList.toggle('res-thing-hide-children', !!match);

      this._refreshAfterChange();
    },
    highlight: (thing, match) => {
      thing.entry.classList.toggle('res-thing-filterline-highlight', !!match);
    },
    hide: (thing, match) => {
      thing.setHideFilter(match);

      this._refreshAfterChange();
    },
    placeholder: (thing, match) => {
      function removePlaceholders() {
        thing.element.classList.remove('res-thing-has-placeholder');

        for (const ele of thing.entry.querySelectorAll('.res-thing-placeholder-message')) ele.remove();
      }

      function replaceWithPlaceholder(ele) {
        if (!ele) return;
        const placeholder = string.html`<span class="res-thing-placeholder-message">
					<span class="res-icon">&#xF093;</span> Content ignored. Click to show anyway.
				</span>`;
        ele.after(placeholder);
        thing.element.classList.add('res-thing-has-placeholder');
        waitForEvent(placeholder, 'click').then(removePlaceholders);
      }

      if (match) {
        replaceWithPlaceholder(thing.getTitleElement());
        replaceWithPlaceholder(thing.getTextBody());
      } else {
        removePlaceholders();
      }

      this._refreshAfterChange();
    },
    collapse: (thing, match) => {
      thing.setCommentCollapse(!!match, 'filterline', true);

      this._refreshAfterChange();
    }
  };
  _refreshAfterChange = frameThrottle(() => {
    SelectedThing.refresh();
    this.checkEmptyState();
  });

  getFiltersToTest(currentFilter?: Filter, invokedByFilter?: Filter): Filter[] {
    if (!invokedByFilter) return this.sortedFilters;
    const invokedByFilterIndex = this.sortedFilters.indexOf(invokedByFilter);
    const currentFilterIndex = this.sortedFilters.indexOf(currentFilter);

    if (!currentFilter) {
      // No other filters did match last time; only retest this
      return [invokedByFilter];
    } else if (currentFilter === invokedByFilter) {
      // The invokedBy filter matched last time; start testing from that one
      return this.sortedFilters.slice(invokedByFilterIndex);
    } else if (currentFilterIndex > invokedByFilterIndex) {
      // Always store a reference to the first matched filter
      return [invokedByFilter, currentFilter];
    } else {
      // Some earlier filter matched last time; ignore
      return [];
    }
  }

  refreshThing = keyedMutex(fastAsync(function* (thing: Thing, invokedByFilter?: Filter) {
    if (!this.currentMatches.has(thing)) this.currentMatches.set(thing, {});
    const currentMatches = this.currentMatches.get(thing);
    const activeEffects = Object.keys(this.availableEffects);
    // $FlowIssue Array#flat
    const allFilters = [...new Set(activeEffects.map(effect => this.getFiltersToTest(currentMatches[effect], invokedByFilter)).flat())] // Keep order
    .sort((a, b) => this.sortedFilters.indexOf(a) - this.sortedFilters.indexOf(b));
    const refreshEffects = activeEffects.filter(effect => !( // Only update effects that the current filter has touched
    invokedByFilter && !invokedByFilter.effects.hasOwnProperty(effect) || // Don't update effects whose current matched filter will not be tested
    currentMatches[effect] && !allFilters.includes(currentMatches[effect])));

    const updateEffect = (effect, filter) => {
      const old = currentMatches[effect];
      if (filter == old) return; // eslint-disable-line eqeqeq

      currentMatches[effect] = filter;
      this.availableEffects[effect](thing, filter);
      if (this.displayReasons) this.refreshDisplayReasonsChunked([thing]);
    };

    for (const filter of allFilters.filter(v => this.getActiveFilters().includes(v))) {
      const effects = filter.getEffects().filter(v => refreshEffects.includes(v));

      if (effects.length && (yield filter.matches(thing))) {
        for (const effect of effects) updateEffect(effect, filter);

        pull(refreshEffects, ...effects);
      }
    }

    for (const effect of refreshEffects) {
      updateEffect(effect, null);
    }
  }));

  refresh(invokedByFilter?: Filter, things: Array<Thing> = Array.from(this.things)) {
    return Promise.all(things.map(thing => this.refreshThing(thing, invokedByFilter)));
  }

  addThing(thing: Thing) {
    this.things.add(thing);
    if (this.isInitialized()) return this.refreshThing(thing);
  }

  getThings(withEffect: string) {
    return Array.from(this.currentMatches.entries()).filter(([, effects]) => effects[withEffect]).map(([thing]) => thing);
  }

  checkEmptyState = (() => {
    let notification;
    const showNotification = debounce(() => {
      const info = $('<p>').text(i18n('filteRedditEmptyNotificationInfo'));
      const toggle = $('<button>').text(i18n('filteRedditEmptyNotificationToggleShowReason')).click(() => {
        this.toggleDisplayReasons();
      });
      notification = Notifications.showNotification({
        moduleID: FilteReddit.module.moduleID,
        notificationID: 'everyThingHidden',
        header: i18n('filteRedditEmptyNotificationHeader'),
        message: $('<div>').append(info).append(toggle).get(0),
        closeDelay: Infinity
      });
    }, 3000);
    return () => {
      if (Array.from(this.things).some(v => v.isVisible())) {
        showNotification.cancel();
        if (notification) notification.close();
      } else if (!this.displayReasons && Array.from(this.currentMatches.values()).some(v => v.hide)
      /* check that the reason things are not visible, actually is a filter */
      ) {
          showNotification();
        }
    };
  })();

  toggleDisplayReasons(newState?: boolean = !this.displayReasons) {
    this.displayReasons = newState;
    this.refreshDisplayReasonsChunked(this.things);
    BodyClasses.toggle(this.displayReasons, 'res-display-match-reason');
  }

  refreshDisplayReasonsChunked = forEachChunked(this.refreshDisplayReasons.bind(this));

  async refreshDisplayReasons(thing: Thing) {
    const reasons = this.displayReasons ? await Promise.all(Object.entries(this.currentMatches.get(thing) || {}).map(([effect, filter]) => filter && filter.buildReasonElement(thing, effect)).filter(Boolean)) : [];
    thing.setFilterReasons(reasons);
  }

}