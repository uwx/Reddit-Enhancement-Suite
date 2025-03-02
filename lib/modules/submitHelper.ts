import $ from "jquery";
import { debounce, once } from "lodash-es";
import { Module } from "../core/module";
import { ajax, i18n } from "../environment";
import { formatDateDiff, isAppType, isPageType, string, waitForDescendant, waitForEvent } from "../utils";
import type { RedditListing, RedditLink } from "../types/reddit";
import * as CommandLine from "./commandLine";
import * as SettingsNavigation from "./settingsNavigation";
export const module: Module<any> = new Module('submitHelper');
module.moduleName = 'submitHelperName';
module.category = 'submissionsCategory';
module.description = 'submitHelperDesc';
module.options = {
  warnAlreadySubmitted: {
    title: 'submitHelperWarnAlreadySubmittedTitle',
    type: 'boolean',
    value: true,
    description: 'submitHelperWarnAlreadySubmittedDesc'
  },
  uncheckSendRepliesToInbox: {
    title: 'submitHelperUncheckSendRepliesToInboxTitle',
    type: 'boolean',
    value: false,
    description: 'submitHelperUncheckSendRepliesToInboxDesc'
  },
  focusFormOnLoad: {
    title: 'submitHelperFocusFormOnLoadTitle',
    type: 'boolean',
    value: true,
    description: 'submitHelperFocusFormOnLoadDesc'
  }
};
const $repostWarning = once(() => $(string.html`
	<div class="spacer" style="display: none">
		<div class="roundfield info-notice">
			<a style="float: right" class="gearIcon" href="${SettingsNavigation.makeUrlHash(module.moduleID, 'warnAlreadySubmitted')}"></a>
			<p>This link was submitted to <a class="subredditLink" href="#"></a>:<span class="time"></span><a class="seeMore" href="#" target="_blank" rel="noopener noreferer">(see more)</a></p>
		</div>
	</div>
`));
let urlField, srField;

module.go = () => {
  implementOptions();

  // Register submit CLI if not on the submit page
  if (!isPageType('submit')) {
    registerCommandLine();
  }
};

async function implementOptions() {
  if (isAppType('d2x')) {
    waitForEvent(document, 'reddit.urlChanged').then(implementOptions);
  }

  if (!isPageType('submit')) {
    return;
  }

  // Implement submitHelper preferences if on the submit page
  if (module.options.warnAlreadySubmitted.value) {
    const urlFieldDiv = document.querySelector('#url-field');

    if (urlFieldDiv) {
      $(urlFieldDiv).parent().after($repostWarning());
      urlField = ((urlFieldDiv.querySelector('#url') as any) as HTMLInputElement);
      srField = ((document.querySelector('#sr-autocomplete') as any) as HTMLInputElement);
      $([srField, urlField]).on('input keydown', debounce(updateRepostWarning, 300));
      // No event is fired when reddit's js changes the subreddit field, so update whenever the user clicks
      $('#suggested-reddits a, #sr-drop-down').on('click', updateRepostWarning);
      // We would allow reddit to show/hide the message for link/text posts with #link-desc
      // but some subreddits hide this box, so we'll do it manually.
      const linkButton = document.querySelector('a.link-button');
      const textButton = document.querySelector('a.text-button');

      if (linkButton && textButton) {
        linkButton.addEventListener('click', () => {
          updateRepostWarning();
        });
        textButton.addEventListener('click', () => {
          $repostWarning().hide();
        });
      }
    }
  }

  if (module.options.uncheckSendRepliesToInbox.value) {
    const selector = isAppType('d2x') ? '[aria-labelledby="send-replies"]' : '#sendreplies';
    const sendReplies: HTMLElement | null | undefined = await waitForDescendant(document.documentElement, selector);

    if (sendReplies) {
      sendReplies.click();
    }
  }

  if (module.options.focusFormOnLoad.value) {
    if (isAppType('d2x')) {
      $('textarea').filter(':visible').first().focus();
    } else {
      $('form.submit [name=url], form.submit [name=title]').filter(':visible').first().focus();
    }
  }
}

function registerCommandLine() {
  const trailingUrl = /(?:\s+(\w+:\/\/.+))$/;
  const cliParams = /^(?:(?:\/?r\/)?(\w+))?(?:\s+(.*))?$/;

  function commandLineParameters(val) {
    const urlResult = trailingUrl.exec(val);
    const result = cliParams.exec(urlResult ? val.slice(0, val.length - urlResult[0].length) : val);
    return result ? result.slice(1).concat(urlResult ? urlResult[1] : undefined) : [];
  }

  CommandLine.registerCommand(/^p(?:ost)?$/, 'post [subreddit] [title] [url] - submit a post to a subreddit', (command, val) => {
    const [subreddit, title, url] = commandLineParameters(val);

    if (!subreddit) {// Use default value
    } else if (url) {
      return `Post ${url} to /r/${subreddit}: ${title || ''}`;
    } else if (title) {
      return `Post to /r/${subreddit}: ${title}`;
    } else if (subreddit) {
      return `Post to /r/${subreddit}`;
    }
  }, (command, val) => {
    const [subreddit, title, url] = commandLineParameters(val);
    const redirect = subreddit ? string.encode`/r/${subreddit}/submit?title=${title || ''}&url=${url || ''}` : '/submit';
    window.location = redirect;
  });
}

function showRepostWarning(sr, url, date) {
  $repostWarning().find('.subredditLink').attr('href', `/r/${sr}`).text(`/r/${sr}`).end().find('.seeMore').attr('href', string.encode`/r/${sr}/search?restrict_sr=on&sort=relevance&q=url%3A${url}`).end().find('.time').text(` ${i18n('submitHelperTimeAgo', formatDateDiff(date))} `).end().fadeIn(300);
}

function hideRepostWarning() {
  $repostWarning().fadeOut(300);
}

async function updateRepostWarning() {
  if (!urlField.value) return;
  const stripUrlRe = /^(?:https?:\/\/)?(?:(?:www|i|m)\.)?(.+?)\/?(?:\.\w+)?(?:#[^\/]*)?$/i;
  const subreddit = srField.value;
  const match = stripUrlRe.exec(urlField.value);

  if (subreddit && match) {
    const [, userUrl] = match;

    try {
      const {
        data
      } = (await ajax({
        url: string.encode`/r/${subreddit}/search.json`,
        query: {
          restrict_sr: 'on',
          sort: 'relevance',
          limit: 1,
          q: `url:${userUrl}`
        },
        type: 'json'
      }) as RedditListing<RedditLink>);

      if (data && data.children.length && (data.children[0].data.url.match(stripUrlRe) as any)[1] === userUrl) {
        showRepostWarning(subreddit, userUrl, new Date(data.children[0].data.created_utc * 1000));
      } else {
        hideRepostWarning();
      }
    } catch (e) {
      hideRepostWarning();
      throw e;
    }
  } else {
    hideRepostWarning();
  }
}