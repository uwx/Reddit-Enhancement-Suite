import { $Keys } from "utility-types";
import { JSAPI_CONSUMER_NAME } from "../constants/jsapi";
import type { CommentEventData // eslint-disable-line no-unused-vars
, CommentAuthorEventData // eslint-disable-line no-unused-vars
, PostAuthorEventData // eslint-disable-line no-unused-vars
, PostEventData // eslint-disable-line no-unused-vars
, SubredditEventData // eslint-disable-line no-unused-vars
, UserHovercardEventData // eslint-disable-line no-unused-vars
, PostModToolsEventData // eslint-disable-line no-unused-vars
} from "../types/events";
const callbacks = {
  subreddit: [],
  postAuthor: [],
  post: []
};

/* eslint-disable no-redeclare, no-unused-vars */
export function watchForRedditEvents(type: "comment", callback: (arg0: HTMLElement, arg1: CommentEventData) => void | Promise<void>): void;
export function watchForRedditEvents(type: "subreddit", callback: (arg0: HTMLElement, arg1: SubredditEventData) => void | Promise<void>): void;
export function watchForRedditEvents(type: "postAuthor", callback: (arg0: HTMLElement, arg1: PostAuthorEventData) => void | Promise<void>): void;
export function watchForRedditEvents(type: "post", callback: (arg0: HTMLElement, arg1: PostEventData) => void | Promise<void>): void;
export function watchForRedditEvents(type: "userHovercard", callback: (arg0: HTMLElement, arg1: UserHovercardEventData) => void | Promise<void>): void;
export function watchForRedditEvents(type: "commentAuthor", callback: (arg0: HTMLElement, arg1: CommentAuthorEventData) => void | Promise<void>): void;
export function watchForRedditEvents(type: "postModTools", callback: (arg0: HTMLElement, arg1: PostModToolsEventData) => void | Promise<void>): void;
export function watchForRedditEvents(type: 'comment' | 'userHovercard' | 'commentAuthor' | 'postModTools' | keyof typeof callbacks, callback) {
  if (!callbacks[type]) {
    callbacks[type] = [];
  }

  callbacks[type].push(callback);
}

/* eslint-enable no-redeclare */
function handleRedditEvent(event) {
  const {
    target,
    detail: {
      type,
      data
    }
  } = event;
  const fns = callbacks[type];

  if (!fns) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('Unhandled reddit event type:', type);
    }

    return;
  }

  let expandoId = `${type}|`;

  switch (type) {
    case 'postAuthor':
      expandoId += data.post.id;
      break;

    case 'commentAuthor':
      expandoId += data.comment.id;
      break;

    case 'userHovercard':
      expandoId += `${data.contextId}|${data.user.id}`;
      break;

    case 'subreddit':
    case 'post':
    case 'postModTools':
    default:
      expandoId += data.id;
      break;
  }

  const update = target.expando && target.expando._.id === expandoId ? (target.expando._.update || 0) + 1 : 0;
  const expando = { ...data,
    _: {
      id: expandoId,
      type,
      update
    }
  };
  target.expando = expando;
  const ownedTarget = target.querySelector(`[data-name="${JSAPI_CONSUMER_NAME}"]`);

  for (const fn of fns) {
    try {
      fn(ownedTarget, expando);
    } catch (e) {
      console.log(e);
    }
  }
}

export function initD2xWatcher() {
  document.addEventListener('reddit', (handleRedditEvent as any), true);
  const meta = document.createElement('meta');
  meta.name = 'jsapi.consumer';
  meta.content = JSAPI_CONSUMER_NAME;
  document.head.appendChild(meta);
  meta.dispatchEvent(new CustomEvent('reddit.ready'));
}