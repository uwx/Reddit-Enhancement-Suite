import { $PropertyType } from "utility-types";

/**
 * Types representing reddit's data models.
 * Many obscure/unused fields omitted.
 */
export type RedditComment = {
  kind: "t1";
  data: {
    author: string;
    body: string;
    body_html: string;
    created: number;
    created_utc: number;
    id: string;
    subreddit: string;
  };
};
export type RedditAccount = {
  kind: "t2";
  data: {
    comment_karma: number;
    created: number;
    created_utc: number;
    gold_expiration: number;
    id: string;
    is_friend: boolean;
    is_gold: boolean;
    is_mod: boolean;
    is_suspended: boolean;
    link_karma: number;
    name: string;
  };
};
export type CurrentRedditUser = {
  kind: "t2";
  loid: string;
  data: {
    modhash: string;
    comment_karma: number;
    created: number;
    created_utc: number;
    gold_expiration: number;
    has_mod_mail: boolean | null | undefined;
    id: string;
    in_beta: boolean;
    inbox_count: number;
    is_friend: boolean;
    is_gold: boolean;
    is_mod: boolean;
    is_suspended: boolean;
    link_karma: number;
    name: string;
    new_modmail_exists: boolean;
    over_18: boolean; // etc

  };
};
type PreviewSource = {
  url: string;
  height: number;
  width: number;
};
export type RedditLink = {
  kind: "t3";
  data: {
    author: string;
    created: number;
    created_utc: number;
    edited: number;
    domain: string;
    id: string;
    num_comments: number;
    permalink: string;
    score: number;
    subreddit: string;
    title: string;
    url: string;
    gallery_data?: {
      items: Array<{
        caption?: string;
        media_id: string;
      }>;
    };
    media_metadata?: Record<string, {
      m: string;
    }>;
    preview?: {
      images: Array<{
        id: string;
        resolutions: PreviewSource[];
        source: PreviewSource;
        variants: Record<string, void | {
          resolutions: PreviewSource[];
          source: PreviewSource;
        }>;
      }>;
    };
    crosspost_parent_list?: Array<$PropertyType<RedditLink, "data">>;
    selftext?: string;
    selftext_html?: string;
  };
};
export type RedditMessage = {
  kind: "t4";
  data: {
    author: string;
    body: string;
    body_html: string;
    created: number;
    created_utc: number;
    dest: string;
    id: string;
    subject: string;
    subreddit: string | null | undefined;
  };
};
export type RedditSubreddit = {
  kind: "t5";
  data: {
    created: number;
    created_utc: number;
    description: string;
    description_html: string;
    display_name: string;
    id: string;
    name: string;
    over18: boolean;
    public_description: string;
    public_description_html: string;
    quarantine: boolean;
    subscribers: number;
    title: string;
    url: string;
    user_is_subscriber: boolean;
  };
};
export type RedditThing = RedditComment | RedditAccount | RedditLink | RedditMessage | RedditSubreddit;
export type RedditListing<T extends RedditThing> = {
  kind: "Listing";
  data: {
    children: T[];
    after: string | null | undefined;
    before: string | null | undefined;
  };
};
export type RedditSearchSubredditNames = {
  names: string[];
};
export type RedditSearchWikiNames = {
  kind: "wikipagelisting";
  data: Array<string>;
};
export type RedditStylesheet = {
  kind: "stylesheet";
  data: {
    stylesheet: string;
    subreddit_id: string;
    images: Array<{
      link: string;
      name: string;
      url: string;
    }>;
  };
};
export type RedditWikiPage = {
  kind: "wikipage";
  data: {
    content_html: string;
    content_md: string;
    may_revise: boolean;
    revision_by: RedditAccount;
    revision_date: number;
  };
};