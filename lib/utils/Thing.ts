import { memoize } from "lodash-es";
import { filterMap } from "./array";
import { throttleQueuePositionReset } from "./async";
import { click, getPercentageVisibleYAxis, scrollToElement } from "./dom";
import { downcast } from "./flow";
import { currentSubreddit } from "./currentLocation";
import { regexes } from "./location";
const elementMap = new WeakMap();
const things = new Set();
const SECRET_TOKEN = new class {}();

/**
 * Wrapper class around reddit's concept of a "Thing".
 * Use Thing.from or Thing.checkedFrom (fallible/infallible respectively) to construct a Thing.
 * Uniqueness is guaranteed, i.e. `Thing.from(element) === Thing.from(element)`.
 */
export class Thing {
  static thingSelector = '.thing, .search-result-link';
  static entrySelector = '.entry';
  // This query may be expensive and performed fairly often
  static thingElements = memoize((doc: HTMLElement = document.body.querySelector('.content[role="main"]')): HTMLElement[] => Array.from(doc.querySelectorAll(Thing.thingSelector)));

  static things(doc: any): Thing[] {
    return Thing.thingElements(doc).map(e => Thing.checkedFrom(e));
  }

  static visibleThingElements(doc: any): HTMLElement[] {
    return Thing.thingElements(doc).filter(v => v.offsetParent);
  }

  static visibleThings(doc: any): Thing[] {
    return filterMap(Thing.visibleThingElements(doc), ele => {
      const thing = Thing.from(ele);
      if (thing) return [thing];
    });
  }

  element: HTMLElement;
  entry: HTMLElement;
  parent: Thing | null | undefined;
  children = new Set();
  // Tasks are added and generally executed by watchers
  tasks: {
    completed: boolean;
    visible: Array<() => any>;
    immediate: Array<() => any>;
    byId: Map<unknown, () => any>;
  } = {
    completed: false,
    visible: [],
    immediate: [],
    byId: new Map()
  };

  static checkedFrom(element: HTMLElement | Thing): Thing {
    const thing = Thing.from(element);

    if (!thing) {
      throw new Error(`Could not construct Thing from ${String(element)}`);
    }

    return thing;
  }

  static from(element: (HTMLElement | null | undefined) | Thing): Thing | null | undefined {
    if (!element) return null;
    if (element instanceof Thing) return element;
    const thingElement = element.closest(Thing.thingSelector);
    if (!thingElement) return null;
    if (elementMap.has(thingElement)) return elementMap.get(thingElement);
    const entry = thingElement.querySelector(Thing.entrySelector) || thingElement;
    const thing = new Thing(SECRET_TOKEN, downcast(thingElement, HTMLElement), entry);
    Thing.thingElements.cache.clear();
    elementMap.set(thingElement, thing);
    things.add(thing);
    return thing;
  }

  constructor(token: typeof SECRET_TOKEN, thing: HTMLElement, entry: HTMLElement) {
    if (token !== SECRET_TOKEN) {
      throw new Error('Use Thing.from() or Thing.checkedFrom() instead of new Thing()');
    }

    this.element = thing;
    this.entry = entry;
    const _p = this.element.parentElement;
    this.parent = _p && Thing.from((_p as any).closest('.thing'));
    if (this.parent) this.parent.children.add(this);
  }

  runTasks() {
    if (this.tasks.completed) return;
    this.tasks.completed = true;
    this.tasks.immediate.map(fn => fn());
    this.tasks.visible.map(fn => fn());
  }

  runSurroundingTasks(margin: number = 10) {
    const thingElements = Thing.thingElements();
    const idx = thingElements.indexOf(this.element);
    const min = Math.max(idx - margin, 0);
    const max = Math.min(idx + margin, thingElements.length - 1);

    for (let i = min; i <= max; i++) {
      // eslint-disable-line no-restricted-syntax
      const thing = Thing.checkedFrom(thingElements[i]);
      if (!thing.tasks.completed && thing.isVisible()) thing.runTasks();
    }
  }

  anchor() {
    // Keep the viewport anchored relative to this thing if it is in the viewport
    const anchor = getPercentageVisibleYAxis(this.entry) && {
      to: this.entry.getBoundingClientRect().top
    };
    if (!anchor) return;
    requestAnimationFrame(() => {
      if (!this.entry.offsetParent) return;
      scrollToElement(this.entry, undefined, {
        scrollStyle: 'none',
        anchor
      });
    });
  }

  setHideFilter(match: any) {
    this.element.classList.toggle('res-thing-filter-hide', !!match);

    if (this.isComment()) {
      this.refreshPartialVisibility();

      for (const p of this.getParents()) p.refreshPartialVisibility();
    }
  }

  setFilterReasons(elements: Array<HTMLElement>) {
    for (const old of this.element.querySelectorAll('.res-thing-filter-remove-matching-entry')) old.remove();

    this.element.prepend(...elements);
  }

  // `throttleQueuePositionReset` ensures that children will be evaluated first
  // Class is applied when a thing is hidden by a filter, but may have descendants that are not
  refreshPartialVisibility = throttleQueuePositionReset(() => {
    this.element.classList.toggle('res-thing-partial', this.isHiddenByFilter(true) && ( // Comment has unloaded comments whose state is still not known
    // TODO If clicking this causes the comment to disappear, notify!
    this.element.matches('.morerecursion, .morechildren') || // Comment has unfilter children
    Array.from(this.children).some(v => !v.isHiddenByFilter())));
  });

  getDirectionOf(other: Thing): ("down" | "up") | null | undefined {
    if (!this.isVisible() || !other.isVisible()) return;
    return other.entry.compareDocumentPosition(this.entry) & Node.DOCUMENT_POSITION_FOLLOWING ? 'up' : 'down';
  }

  getThreadTop(): Thing {
    let thing = this; // eslint-disable-line consistent-this

    let current = this.element;

    while (current = current.parentElement) {
      if (current.matches(Thing.thingSelector)) thing = downcast(current, HTMLElement);
    }

    return Thing.checkedFrom(thing);
  }

  getParents(): Thing[] {
    const parents = [];
    let level = this; // eslint-disable-line consistent-this

    while (level = level.parent) parents.push(level);

    return parents;
  }

  getNext({
    direction = 'down',
    excludeMoreChildren = false
  }: {
    direction?: "up" | "down";
    excludeMoreChildren?: boolean;
  } = {}, things: HTMLElement[] = Thing.thingElements()): Thing | null | undefined {
    let index = things.indexOf(this.element);
    let target;

    do {
      index += direction === 'down' ? 1 : -1;
      const _target = things[index];
      target = _target;
      if (!target) return null;
      if (excludeMoreChildren && target.matches('.morechildren')) continue;
    } while (!target.offsetParent);

    return Thing.from(target);
  }

  getNextSibling(options: any): Thing | null | undefined {
    if (!this.element.parentElement) return null;
    const things = Array.from(this.element.parentElement.children).filter(e => e.matches(Thing.thingSelector));
    return this.getNext(options, things);
  }

  getClosest(func: (...args: any) => Thing | null | undefined, ...args: unknown[]): Thing | null | undefined {
    const target = Reflect.apply(func, this, args);

    if (target) {
      return target;
    } else {
      if (this.parent) return this.parent.getClosest(func, ...args);
    }
  }

  getClosestVisible(options: any = {
    excludeMoreChildren: true
  }): Thing | null | undefined {
    if (this.element.offsetParent) return this;
    return this.getNext({
      direction: 'down',
      ...options
    }) || this.getNext({
      direction: 'up',
      ...options
    });
  }

  isMessage(): boolean {
    return this.element.classList.contains('message');
  }

  isSubreddit(): boolean {
    return this.element.classList.contains('subreddit');
  }

  isPost(): boolean {
    return this.element.classList.contains('link') || this.element.classList.contains('search-result-link');
  }

  isLinkPost(): boolean {
    if (!this.isPost()) {
      return false;
    }

    if (this.element.classList.contains('search-result-link')) {
      return !this.element.querySelector('a').classList.contains('self');
    } else {
      return !this.element.classList.contains('self');
    }
  }

  isSelfPost(): boolean {
    if (!this.isPost()) {
      return false;
    }

    if (this.element.classList.contains('search-result-link')) {
      return this.element.querySelector('a').classList.contains('self');
    } else {
      return this.element.classList.contains('self');
    }
  }

  isComment(): boolean {
    return this.element.classList.contains('comment') || this.element.classList.contains('was-comment');
  }

  isTopLevelComment(): boolean {
    return this.isComment() && !!this.element.parentElement && this.element.parentElement.classList.contains('nestedlisting');
  }

  getTitle(): string {
    const element = this.getTitleElement();
    return element && element.textContent || '';
  }

  getTitleElement(): HTMLAnchorElement | null | undefined {
    return (this.entry.querySelector('a.title, a.search-title') || this.entry.querySelector('.title') as any);
  }

  getTitleUrl(): string {
    const element = this.getTitleElement();

    if (element) {
      return element.href;
    }

    return '';
  }

  getPostLink(): HTMLAnchorElement {
    return downcast(this.entry.querySelector('a.title, a.search-link'), HTMLAnchorElement);
  }

  getPostUrl(): string {
    return this.element.dataset.url || this.getPostLink().href;
  }

  getTextBody(): HTMLElement {
    return this.entry.querySelector('.md');
  }

  getCommentsLink(): HTMLAnchorElement | null | undefined {
    const a = this.entry.querySelector('a.comments, a.search-comments');
    return a instanceof HTMLAnchorElement ? a : undefined;
  }

  getCommentPermalink(): HTMLAnchorElement | null | undefined {
    return (this.entry.querySelector('a.bylink') as any);
  }

  getHideElement(): HTMLAnchorElement | null | undefined {
    return (this.entry.querySelector('.hide-button a, .unhide-button a') as any);
  }

  getButtons(): HTMLAnchorElement {
    return (this.entry.querySelector('.flat-list.buttons') as any);
  }

  getNumberOfChildren(): number {
    // Parse the text, since all children elements may not be loaded
    const numChildrenElem = this.entry.querySelector('.numchildren');
    const match = numChildrenElem && /(\d+)/.exec(numChildrenElem.textContent);
    return match && parseInt(match[1], 10) || 0;
  }

  static _parseScore(scoreEle: HTMLElement): number {
    return parseInt(scoreEle.title || scoreEle.textContent, 10) || 0;
  }

  getScore(): number | null | undefined {
    if (!isNaN(this.element.dataset.score)) {
      return parseInt(this.element.dataset.score, 10);
    }

    const element = this._getActiveScoreElement();

    // parseInt() strips off the ' points' from comments
    return element && Thing._parseScore(element);
  }

  _getActiveScoreElement(): HTMLElement | null | undefined {
    if (this.isPost()) {
      return this.element.querySelector(['.midcol.unvoted > .score.unvoted', '.midcol.likes > .score.likes', '.midcol.dislikes > .score.dislikes', '.search-score'].join(', '));
    } else {
      // if (this.isComment()) {
      return this.entry.querySelector('.tagline > .score');
    }
  }

  getAllScoreElements(): Array<[HTMLElement, number]> {
    const toScoreTuple = ele => [ele, Thing._parseScore(ele)];

    if (this.isPost()) {
      return Array.from(this.element.querySelectorAll('.midcol > .score, .search-score')).map(toScoreTuple);
    } else {
      // if (this.isComment()) {
      return Array.from(this.entry.querySelectorAll('.tagline > .score')).map(toScoreTuple);
    }
  }

  getAuthor(): string | null | undefined {
    const data = this.element.getAttribute('data-author');

    if (data) {
      return data;
    }

    const element = this.getAuthorElement();

    if (element) {
      const match = regexes.profile.exec(element.pathname);

      if (match) {
        return match[1];
      }
    }
  }

  getAuthorUrl(): string {
    const author = this.getAuthor();

    if (author) {
      return `/user/${author}/`;
    }

    return '';
  }

  getAuthorElement(): HTMLAnchorElement | null | undefined {
    return (this.entry.querySelector('.tagline a.author, .search-author .author') as any);
  }

  getSubreddit(): string | null | undefined {
    const data = this.element.getAttribute('data-subreddit');

    if (data) {
      return data;
    }

    const element = this.getSubredditLink();

    if (element) {
      const match = regexes.subreddit.exec(element.pathname);

      if (match) {
        return match[1];
      }
    } else {
      return currentSubreddit();
    }
  }

  getSubredditLink(): HTMLAnchorElement | null | undefined {
    if (this.isPost()) {
      return (this.entry.querySelector('.tagline a.subreddit, a.search-subreddit-link') as any);
    } else if (this.isComment()) {
      // TODO: does .parent a.subreddit work?
      return (this.entry.querySelector('.parent a.subreddit, .tagline .subreddit a') as any);
    }
  }

  getPostDomain(): string {
    const data = this.element.getAttribute('data-domain');

    if (data) {
      return data;
    }

    const element = this.getPostDomainLink();

    if (element) {
      return element.textContent;
    }

    const text = this.getPostDomainText();

    if (text) {
      return text;
    }

    const subreddit = this.getSubreddit();

    if (subreddit) {
      return `self.${subreddit}`;
    }

    return 'reddit.com';
  }

  getPostDomainUrl(): string {
    const link = this.getPostDomainLink();

    if (link) {
      return link.href;
    }

    return `/domain/${this.getPostDomain()}/`;
  }

  getPostDomainLink(): HTMLAnchorElement | null | undefined {
    return (this.entry.querySelector('.domain a') as any);
  }

  getPostDomainText(): string {
    const data = this.element.getAttribute('data-domain');

    if (data) {
      return data;
    }

    const element = this.element.querySelector('.domain');
    if (!element) return '';
    const text = element.textContent || '';
    return text.replace(/[\(\)\s]/g, '');
  }

  getCommentCount(): number | null | undefined {
    const element = this.getCommentCountElement();
    if (!element) return;
    return parseInt(/\d+/.exec(element.getAttribute('data-text') || // In case noCtrlF is applied
    element.textContent), 10) || 0;
  }

  getCommentCountElement(): HTMLElement | null | undefined {
    if (this.isPost()) {
      return this.entry.querySelector('.buttons .comments');
    } else if (this.isComment()) {
      return this.entry.querySelector('.buttons a.full-comments');
    }
  }

  getPostThumbnailUrl(): string {
    const thumbnail = this.getPostThumbnailElement();
    if (!thumbnail) return '';
    return thumbnail.src || '';
  }

  getPostThumbnailElement(): HTMLImageElement | null | undefined {
    return (this.element.querySelector('.thumbnail img') as any);
  }

  getPostFlairText(): string {
    const element = this.getPostFlairElement();
    return element && element.textContent || '';
  }

  getPostFlairElement(): HTMLElement | null | undefined {
    return this.entry.querySelector('.title > .linkflairlabel');
  }

  getUserFlairText(): string {
    const element = this.getUserFlairElement();
    return element && element.textContent || '';
  }

  getUserFlairElement(): HTMLElement | null | undefined {
    return this.entry.querySelector('.tagline > .flair');
  }

  getCrosspostBadgeElement(): HTMLElement | null | undefined {
    return this.entry.querySelector('.crosspost-badge');
  }

  getUpvoteButton(): HTMLElement | null | undefined {
    return this._getVoteButton('div.up, div.upmod');
  }

  getDownvoteButton(): HTMLElement | null | undefined {
    return this._getVoteButton('div.down, div.downmod');
  }

  _getVoteButton(selector: string): HTMLElement | null | undefined {
    const previousSibling: HTMLElement = (this.entry.previousSibling as any);

    if (previousSibling.tagName === 'A') {
      return (previousSibling.previousSibling as any).querySelector(selector);
    } else {
      return previousSibling.querySelector(selector);
    }
  }

  getTimestamp(): Date | null | undefined {
    const element = this.getTimestampElement();
    return element && new Date(element.getAttribute('datetime'));
  }

  getTimestampElement(): HTMLElement | null | undefined {
    return this.entry.querySelector('time');
  }

  getPostEditTimestamp(): number {
    const element = this.getPostEditTimestampElement();
    return element && Date.parse(element.getAttribute('datetime')) / 1000 || 0;
  }

  getPostEditTimestampElement(): HTMLElement | null | undefined {
    return this.entry.querySelector('time.edited-timestamp');
  }

  getFullname(): string {
    return this.element.getAttribute('data-fullname') || '';
  }

  getUserattrsElement(): HTMLElement | null | undefined {
    return this.entry.querySelector('.userattrs');
  }

  getRank(): number | null | undefined {
    const rank = parseInt(this.element.getAttribute('data-rank'), 10);
    if (!isNaN(rank)) return rank;
  }

  getRankElement(): HTMLElement | null | undefined {
    if (!this.isPost()) return;
    return this.element.querySelector('.rank');
  }

  getTaglineElement(): HTMLElement | null | undefined {
    return this.entry.querySelector('.tagline');
  }

  getCommentCollapseToggleElement(): HTMLElement | null | undefined {
    return this.entry.querySelector('.expand');
  }

  setCommentCollapse(state: boolean, reason: string, openOnlyWhenSameReason: boolean = false): HTMLElement | null | undefined {
    const toggle = this.getCommentCollapseToggleElement();
    if (!toggle) return;
    if (state) toggle.setAttribute('collapse-reason', reason);
    if (this.isCollapsed() === state) return;
    if (!state && openOnlyWhenSameReason && toggle.getAttribute('collapse-reason') !== reason) return;
    if (!state) toggle.removeAttribute('collapse-reason');
    click(toggle); // Simulate a click, so that the event bubbles
  }

  getPostTime(): string {
    const element = this.getPostTimeElement();

    if (element) {
      return element.textContent;
    }

    return '';
  }

  getPostTimeElement(): HTMLElement | null | undefined {
    return this.entry.querySelector('.tagline time');
  }

  isNSFW(): boolean {
    return this.element.classList.contains('over18') || !!this.entry.querySelector('.nsfw-stamp');
  }

  isSpoiler(): boolean {
    if (this.element.classList.contains('search-result')) {
      return !!this.entry.querySelector('.spoiler-stamp');
    }

    return this.element.classList.contains('spoiler');
  }

  isCrosspost(): boolean {
    return !!this.getCrosspostBadgeElement();
  }

  isLocked(): boolean {
    if (this.element.classList.contains('search-result')) {
      return this.element.classList.contains('linkflair-locked');
    }

    return this.element.classList.contains('locked');
  }

  isDeleted(): boolean {
    return this.element.classList.contains('deleted');
  }

  isHiddenByFilter(partialAsFiltered: boolean = false): boolean {
    // Keep in sync with the CSS rules
    if (this.element.matches('body.hideOver18 .over18:not(.allowOver18)')) return true;
    if (!this.element.classList.contains('res-thing-filter-hide')) return false;
    if (this.element.classList.contains('res-filterline-highlight-match')) return false;

    if (partialAsFiltered) {
      if (this.element.classList.contains('res-thing-partial') && this.element.classList.contains('res-selected')) return false;
      return true;
    } else {
      if (this.element.classList.contains('res-thing-hide-children')) return true;
      return !this.element.classList.contains('res-thing-partial');
    }
  }

  isCollapsed(): boolean {
    return this.element.classList.contains('collapsed');
  }

  // Should be equivalent to `this.element.offsetParent !== null`
  isVisible(): boolean {
    // Promoted (ads) are often hidden by adblockers, so just assume that they're not visible
    if (this.element.classList.contains('promoted')) return false;
    if (!document.body.classList.contains('res-filters-disabled') && this.isHiddenByFilter()) return false;
    const {
      parent
    } = this;

    if (parent) {
      if (parent.isCollapsed()) return false;
      if (parent.element.classList.contains('res-children-hidden')) return false; // `hideChildComments` module

      if (!parent.isVisible()) return false;
    }

    return true;
  }

  isContentVisible(): boolean {
    return !(this.element.classList.contains('res-thing-has-placeholder') || !document.body.classList.contains('res-filters-disabled') && this.isHiddenByFilter(true) || this.isCollapsed() || !this.isVisible());
  }

  isSelected() {
    return this.element.classList.contains('res-selected');
  }

  isUpvoted() {
    return this.entry.classList.contains('likes');
  }

  isDownvoted() {
    return this.entry.classList.contains('dislikes');
  }

  isUnvoted() {
    return this.entry.classList.contains('unvoted');
  }

}

if (process.env.NODE_ENV === 'development') {
  // for debugging only! do not use `getThingIsVisibleInconsistencies` in any committed code
  window.getThingIsVisibleInconsistencies = () => Array.from(things).filter(v => v.isVisible() === !v.element.offsetParent);
}