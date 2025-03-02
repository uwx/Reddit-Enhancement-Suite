import $ from "jquery";
import { sortBy, once } from "lodash-es";
import { Module } from "../core/module";
import * as Options from "../core/options";
import { CreateElement, frameThrottle, string } from "../utils";
import { multicast } from "../environment";
import * as CommandLine from "./commandLine";
import * as Menu from "./menu";
export const module: Module<any> = new Module('customToggles');
module.moduleName = 'customTogglesName';
module.category = 'coreCategory';
module.description = 'customTogglesDesc';
module.options = {
  toggle: {
    description: 'customTogglesToggleDesc',
    title: 'customTogglesToggleTitle',
    type: 'table',
    fields: [{
      key: 'id',
      name: 'id',
      type: 'hidden',

      get value() {
        return `~${performance.timing.navigationStart + performance.now()}`;
      }

    }, {
      key: 'enabled',
      name: 'enabled',
      type: 'boolean',
      value: true
    }, {
      key: 'text',
      name: 'text',
      type: 'text'
    }],
    value: ([] as Array<[string, boolean, string]>)
  }
};
const toggles: Map<string, Toggle> = new Map();
const customToggles: Array<Toggle> = [];

module.beforeLoad = () => {
  for (const instance of module.options.toggle.value) {
    const [key, initialEnabled, text] = instance;

    if (toggles.has(key)) {
      console.error(`A toggle with key ${key} already exists`, instance);
      continue;
    }

    const toggle = new Toggle(key, text, initialEnabled);
    customToggles.push(toggle);
    toggle.onStateChange(() => {
      // Keep the settings data current to avoid overwriting modifications from other tabs
      instance[1] = toggle.enabled;
      // For modules which update dynamically
      $(module).trigger($.Event('toggle')); // eslint-disable-line new-cap
    });
    toggle.onToggle(() => {
      Options.save(module.options.toggle);
    });
    toggle.addMenuItem();
  }
};

module.contentStart = () => {
  registerCommandLine();
};

export class Toggle {
  text: string;
  enabled: boolean;
  stateChangeCallbacks: Array<() => void> = []; // Invoked on all tabs

  toggleCallbacks: Array<(type: "multicast" | "auto" | "autoLocal" | "manual") => void> = []; // Invoked on the tab which caused the change

  multicast: (arg0: boolean) => any;

  constructor(key: string, text: any, enabled: any) {
    this.text = text;
    this.enabled = enabled;
    this.multicast = multicast(frameThrottle((enabled: boolean) => {
      this.toggle('multicast', enabled);
    }), {
      local: false,
      name: `toggle.${key}`
    });
    toggles.set(key, this);
  }

  toggle(type: any = 'manual', state: boolean = !this.enabled) {
    if (this.enabled === state) return;
    this.enabled = state;

    for (const callback of this.stateChangeCallbacks) callback();

    if (type !== 'multicast') {
      for (const callback of this.toggleCallbacks) callback(type);

      if (type !== 'autoLocal') this.multicast(state);
    }
  }

  onStateChange(callback: any) {
    this.stateChangeCallbacks.push(callback);
  }

  onToggle(callback: any) {
    this.toggleCallbacks.push(callback);
  }

  addMenuItem(title: string = `Toggle ${this.text}`, order: number = 9, on?: string, off?: string) {
    Menu.addMenuItem(once(() => {
      const item = string.html`<div title="${title}">${this.text || '\u00A0'}</div>`;
      const toggle = CreateElement.toggleButton(undefined, this.text, this.enabled, on, off);
      item.append(toggle);
      this.onStateChange(() => {
        toggle.classList.toggle('enabled', this.enabled);
      });
      return item;
    }), e => {
      this.toggle();
      e.stopPropagation();
    }, order);
  }

  addCLI(commandPredicate: string) {
    CommandLine.registerCommand(commandPredicate, `${commandPredicate} - toggle ${this.text}`, () => ` ${this.enabled ? 'Disable' : 'Enable'} ${this.text}`, () => {
      this.toggle();
    });
  }

  buildCheckbox(): HTMLInputElement {
    const checkbox = document.createElement('input');
    checkbox.setAttribute('type', 'checkbox');
    checkbox.checked = this.enabled;
    checkbox.addEventListener('change', () => {
      this.toggle('manual', checkbox.checked);
    });
    this.onStateChange(() => {
      checkbox.checked = this.enabled;
    });
    return checkbox;
  }

}

function registerCommandLine() {
  const getMatchingToggles = val => Array.from(toggles.values()).filter(({
    text
  }) => text.toLowerCase().match(val.toLowerCase())).sort(({
    text: a
  }, {
    text: b
  }) => a.localeCompare(b));

  const bestMatch = val => sortBy(getMatchingToggles(val), ({
    text
  }) => text.toLowerCase().indexOf(val.toLowerCase()))[0];

  CommandLine.registerCommand('toggle', 'toggle - toggle any custom toggle', (command, val) => getMatchingToggles(val).length ? `Toggle ${getMatchingToggles(val).map(toggle => toggle === bestMatch(val) ? `<b>${toggle.text}</b>` : toggle.text).join('|')}` : `No toggles matching <i>${val}</i>`, (command, val) => {
    const match = getMatchingToggles(val)[0];
    if (match) match.toggle();else return `${val} does not match a valid toggle`;
  });
}

export function toggleActive(key: string): boolean {
  const toggle = toggles.get(key);
  return !!toggle && toggle.enabled;
}
// Stage may have the most recent toggles, in case this is invoked while in settingsConsole
export const getToggles = () => (Options.stage.get(module.moduleID) || module.options).toggle.value.map(([key,, text]) => ({
  key,
  text
}));