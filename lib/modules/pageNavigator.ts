import $ from "jquery";
import { once } from "lodash-es";
import { Module } from "../core/module";
import { SelectedThing, addFloater, getHeaderOffset, isPageType, frameThrottle, scrollToElement, string, watchForThings } from "../utils";
import { i18n } from "../environment";
import * as SettingsNavigation from "./settingsNavigation";
export const module: Module<any> = new Module('pageNavigator');
module.moduleName = 'pageNavName';
module.category = 'browsingCategory';
module.description = 'pageNavDesc';
module.options = {
  toTop: {
    type: 'boolean',
    value: true,
    description: 'pageNavToTopDesc',
    title: 'pageNavToTopTitle'
  },
  toComment: {
    type: 'boolean',
    value: true,
    description: 'pageNavToCommentDesc',
    title: 'pageNavToCommentTitle'
  },
  showLink: {
    type: 'boolean',
    value: true,
    description: 'pageNavShowLinkDesc',
    title: 'pageNavShowLinkTitle'
  },
  showLinkNewTab: {
    type: 'boolean',
    value: true,
    description: 'pageNavShowLinkNewTabDesc',
    title: 'pageNavShowLinkNewTabTitle',
    dependsOn: options => options.showLink.value
  }
};

module.beforeLoad = () => {
  if (module.options.showLink.value && isPageType('comments')) {
    watchForThings(['post'], showLinkTitle);
  }
};

module.contentStart = () => {
  if (module.options.toComment.value && isPageType('comments')) {
    backToNewCommentArea();
  }

  if (module.options.toTop.value) {
    backToTop();
  }
};

function backToTop() {
  const element = string.html`<a class="pageNavigator res-icon" data-id="top" href="#header" title="${i18n('pageNavToTopTitle')}">&#xF148;</a>`;
  element.addEventListener('click', (e: Event) => {
    e.preventDefault();
    window.scrollTo(0, 0);
    SelectedThing.move('top');
  });
  addFloater(element, {
    order: 9
  });
}

const showLinkTitleTemplate = ({
  thumbnailSrc,
  linkId,
  settingsHash,
  linkHref,
  linkNewTab,
  title,
  domainHref,
  domain,
  time,
  author,
  authorHref
}) => string.html`
	<div class="res-show-link hide">
		${thumbnailSrc && string._html`
			<span class="res-show-link-thumb"><img src="${thumbnailSrc}" alt="thumbnail" /></span>
		`}
		<a href="#${linkId}" class="res-icon toTop" title="Jump to title">&#xF148;</a>
		<a href="${settingsHash}" class="gearIcon" title="Configure this widget"></a>
		<div class="res-show-link-content">
			<div class="res-show-link-header">
				<a href="${linkHref}" ${linkNewTab && string._html`target="_blank" rel="noopener noreferer"`} class="res-show-link-title">${title}</a>
				<a href="${domainHref}" class="res-show-link-domain">(<span>${domain}</span>)</a>
			</div>
			<div class="res-show-link-tagline">
				Submitted ${time} by
				<a href="${authorHref}" class="res-show-link-author">${author}</a>
			</div>
		</div>
	</div>
`;

function backToNewCommentArea() {
  // TODO Find a way to determine whether the comment area is visible which does not cause a reflow
  const commentArea = document.querySelector('.commentarea > form.usertext textarea:not([disabled])');
  if (!commentArea) return;
  const element = string.html`<a class="pageNavigator res-icon" data-id="addComment" href="#comments" title="${i18n('pageNavToCommentTitle')}">&#xF003;</a>`;
  element.addEventListener('click', (e: Event) => {
    e.preventDefault();
    commentArea.focus();
  });
  addFloater(element, {
    container: 'visibleAfterScroll'
  });
}

const showLinkTitle = once(submissionThing => {
  let $widget;
  let belowSubmission = true;
  let baseHeight, hoverHeight;

  function showWidget() {
    $widget.css({
      top: getHeaderOffset(true)
    }).removeClass('hide');
  }

  function hideWidget() {
    $widget.css({
      top: -baseHeight
    }).addClass('hide');
  }

  function renderWidget() {
    return $(showLinkTitleTemplate({
      linkId: submissionThing.element.id,
      thumbnailSrc: submissionThing.getPostThumbnailUrl(),
      linkHref: submissionThing.getTitleUrl(),
      linkNewTab: module.options.showLinkNewTab.value,
      title: submissionThing.getTitle(),
      domainHref: submissionThing.getPostDomainUrl(),
      domain: submissionThing.getPostDomainText(),
      time: submissionThing.getPostTime(),
      authorHref: submissionThing.getAuthorUrl(),
      author: submissionThing.getAuthor(),
      settingsHash: SettingsNavigation.makeUrlHash(module.moduleID, 'showLink')
    }));
  }

  const updateWidget = frameThrottle((e: WheelEvent) => {
    const scrollingUp = e.deltaY < 0;

    if (scrollingUp && belowSubmission) {
      initialize();
      // We have scrolled up while below the linklisting.
      showWidget();
    } else if ($widget) {
      hideWidget();
    }
  });
  const initialize = once(() => {
    $widget = renderWidget().on('mouseenter', () => $widget.css({
      height: hoverHeight
    })).on('mouseleave', () => $widget.css({
      height: baseHeight
    })).appendTo(document.body);
    baseHeight = $widget.get(0).getBoundingClientRect().height;
    hoverHeight = $widget.get(0).scrollHeight;
    new IntersectionObserver(entries => {
      belowSubmission = !entries[0].isIntersecting;
      if (!belowSubmission) hideWidget();
    }, {
      rootMargin: '100px 0px 0px 0px'
    }).observe(submissionThing.element);
    window.addEventListener('scroll', () => {
      if (scrollToElement.isProgrammaticEvent()) hideWidget();
    });
  });
  window.addEventListener('wheel', updateWidget, {
    passive: true
  });
});