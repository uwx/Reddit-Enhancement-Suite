/* @flow */

import type { PageType, AppType } from '../utils/location';
import type { KeyArray } from '../utils/keycode';

// separate because indexer syntax is not supported in normal (no `declare`) classes
interface Indexable { // eslint-disable-line no-unused-vars
	[key: symbol | string]: any;
}

export class Module<RawOpt extends { [key: string]: any }, Opt extends { [key: string]: ModuleOption<RawOpt> } = RawOpt> implements Indexable {
	moduleID: string;

	moduleName: string;
	category: string = '';
	description: string = '';
	descriptionRaw: boolean = false; // Whether the message is HTML and should not be run through i18n / markdown
	keywords: Array<string> = [];
	bodyClass: boolean = false;
	options: Opt = {} as any;
	include: Array<PageType | AppType | RegExp> = [];
	exclude: Array<PageType | AppType | RegExp> = [];
	shouldRun: () => boolean = () => true;
	onToggle: (enabling: boolean) => void = () => {};
	onSaveSettings: (changedSettings: any) => void = () => {};

	hidden: boolean = false;
	disabledByDefault: boolean = false;
	alwaysEnabled: boolean = false;
	sort: number = 0;

	// no default value for cleaner profiling (modules without a stage defined won't be timed)
	onInit: (() => Promise<void> | void) | void = undefined;
	beforeLoad: (() => Promise<void> | void) | void = undefined;
	contentStart: (() => Promise<void> | void) | void = undefined;
	go: (() => Promise<void> | void) | void = undefined;
	afterLoad: (() => Promise<void> | void) | void = undefined;
	always: (() => Promise<void> | void) | void = undefined;

	permissions: { requiredPermissions: Array<string>, message: string | undefined, } = { requiredPermissions: [] as string[], message: undefined, };

	constructor(moduleID: string) {
		/*:: super(); */
		this.moduleID = moduleID;
		this.moduleName = moduleID;
	}
}

export type OpaqueModuleId = string | { moduleID: string, module?: void } | { module: { moduleID: string } };

export function getModuleId(opaqueId: OpaqueModuleId): string {
	if (!opaqueId) {
		throw new TypeError(`Expected module, moduleID, or namespace; found: ${opaqueId}`);
	}

	if (typeof opaqueId === 'string') {
		// raw moduleID
		return opaqueId;
	} else if (opaqueId.module) {
		// namespace
		return opaqueId.module.moduleID;
	} else {
		// assume module-like object
		return opaqueId.moduleID;
	}
}

export type ModuleOption<Ctx> =
	| BooleanOption<Ctx>
	| TextOption<Ctx>
	| EnumOption<Ctx>
	| KeycodeOption<Ctx>
	| ListOption<Ctx>
	| SelectOption<Ctx>
	| TableOption<Ctx, any>
	| ButtonOption<Ctx>
	| ColorOption<Ctx>
	| BuilderOption<Ctx>;

interface CommonOptionProps<Ctx> {
	title: string,
	description: string,
	keywords?: Array<string>,
	dependsOn?: (opt: Ctx) => boolean,
	advanced?: boolean,
	noconfig?: boolean,
	// Intentionally do not pass in the new value
	// so that it must be read out of `module.options[key].value`
	// for easier grepping (and to enforce stricter types where possible).
	onChange?: () => void,
};

export interface BooleanOption<Ctx> extends CommonOptionProps<Ctx> {
	type: 'boolean',
	value: boolean,
	bodyClass?: boolean | string,
};

export interface TextOption<Ctx> extends CommonOptionProps<Ctx> {
	type: 'text',
	value: string,
};

export interface EnumOption<Ctx> extends CommonOptionProps<Ctx> {
	type: 'enum',
	value: string,
	values: Array<{
		name: string,
		value: string,
	}>,
	bodyClass?: boolean | string,
};

export interface KeycodeOption<Ctx> extends CommonOptionProps<Ctx> {
	type: 'keycode',
	value: KeyArray,
	// special for keyboardNav
	goMode?: boolean,
	callback?: () => void,
	include?: Array<PageType | AppType | RegExp>,
	requiresModules?: Array<OpaqueModuleId>,
	mustBeLoggedIn?: boolean,
};

export interface ListOption<Ctx> extends CommonOptionProps<Ctx> {
	type: 'list',
	listType: ListType,
	value: string,
};

type ListType = 'subreddits';

export interface SelectOption<Ctx> extends CommonOptionProps<Ctx> {
	type: 'select',
	value: string,
	values: Array<{
		name: string,
		value: string,
		style: string,
	}>,
};

export interface TableOption<Ctx, V extends ReadonlyArray<any>> extends CommonOptionProps<Ctx> {
	type: 'table',
	addRowText?: string,
	fields: TableField[],
	value: V[],
	sort?: (a: V, b: V) => number,
};

type TableField = HiddenField | TextField | BooleanField | ListField | PasswordField | KeycodeField | TextareaField | EnumField | ColorField | SelectField;

type HiddenField = {
	type: 'hidden',
	key: string,
	name: string,
	value?: string,
};

type TextField = {
	type: 'text',
	key: string,
	name: string,
	value?: string,
};

type BooleanField = {
	type: 'boolean',
	key: string,
	name: string,
	value: boolean,
};

type ListField = {
	type: 'list',
	key: string,
	name: string,
	listType: ListType,
};

type PasswordField = {
	type: 'password',
	key: string,
	name: string,
};

type KeycodeField = {
	type: 'keycode',
	key: string,
	name: string,
};

type TextareaField = {
	type: 'textarea',
	key: string,
	name: string,
};

type EnumField = {
	type: 'enum',
	key: string,
	name: string,
	value: string,
	values: Array<{
		name: string,
		value: string,
	}>,
};

type ColorField = {
	type: 'color',
	key: string,
	name: string,
};

type SelectField = {
	type: 'select',
	key: string,
	name: string,
	value: string,
	values: Array<{
		name: string,
		value: string,
		style?: string,
	}>,
};

export interface ButtonOption<Ctx> extends CommonOptionProps<Ctx> {
	type: 'button',
	text?: string | HTMLElement,
	callback?: (() => Promise<void> | void) | string | { moduleID: string },
	values?: Array<{ text: ButtonOption<Ctx>['text'], callback: ButtonOption<Ctx>['callback'] }>,
};

export interface ColorOption<Ctx> extends CommonOptionProps<Ctx> {
	type: 'color',
	value: string,
};

export interface BuilderOption<Ctx> extends CommonOptionProps<Ctx> {
	type: 'builder',
	addItemText: string,
	defaultTemplate: () => BuilderRootValue,
	cases: { [key: string]: BuilderCase },
	value: BuilderRootValue[],
	customOptionsFields: Array<Array<BuilderField | string>>,
};

export type BuilderRootValue = {
	note: string,
	ver: number,
	id: string,
	body: BuilderValue,
	opts?: {
		[key: string]: unknown,
		// Some typed (reserved) values in order to simplify type checking
		name?: string,
	},
};

export type BuilderValue = {
	type: string,
	[key: string]: any,
};

type BuilderCase = {
	text: string,
	fields: Array<BuilderField | string>,
};

type BuilderField = BuilderSelectField | BuilderMultiField | BuilderDurationField | BuilderChecksetField | BuilderNumberField | BuilderCheckboxField | BuilderGenericInputField;

type PredefinedSelectChoice = 'COMPARISON';

type BuilderSelectField = {
	type: 'select',
	options: Array<string | [string, string]> | PredefinedSelectChoice,
	id: string,
};

type BuilderMultiField = {
	type: 'multi',
	include: 'all',
	id: string,
};

type BuilderDurationField = {
	type: 'duration',
	id: string,
};

type BuilderChecksetField = {
	type: 'checkset',
	items: string[],
	id: string,
};

type BuilderNumberField = {
	type: 'number',
	id: string,
};

type BuilderCheckboxField = {
	type: 'check',
	id: string,
	label: string,
};

type BuilderGenericInputField = {
	type: string,
	id: string,
};
