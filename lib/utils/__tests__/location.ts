import test from "ava";
import { regexes, execRegexes } from "../location";

function regexMatches(t, regex, matches) {
  for (const m of matches) {
    const [str, ...captureGroups] = [].concat(m);
    t.regex(str, regex); // for better error reporting when tests fail

    t.deepEqual(regex.exec(str).slice(1), captureGroups, str);
  }
}

function execRegexMatches(t, execRegex, matches) {
  for (const m of matches) {
    const [str, ...captureGroups] = [].concat(m);
    // TODO: better error reporting when tests fail
    t.deepEqual(execRegex(str).slice(1), captureGroups, str);
  }
}

function regexDoesntMatch(t, regex, strings) {
  for (const str of strings) {
    t.false(regex.test(str));
  }
}

test('frontpage', regexMatches, regexes.frontpage, ['/', '/hot', '/new', '/rising', '/controversial', '/top']);
test('comments regex', regexMatches, regexes.comments, [['/r/aww/comments/4ooe2m/', 'aww', undefined, '4ooe2m'], ['/r/aww/comments/4ooe2m', 'aww', undefined, '4ooe2m'], ['/user/Shitty_Watercolour/comments/63tmon/', undefined, 'user/Shitty_Watercolour', '63tmon'], ['/user/Shitty_Watercolour/comments/63tmon', undefined, 'user/Shitty_Watercolour', '63tmon'], ['/comments/4ooe2m/', undefined, undefined, '4ooe2m'], ['/comments/4ooe2m', undefined, undefined, '4ooe2m'], ['/r/softwaregore/comments/5j23v3/handling_of_unicode_characters_ดดด/', 'softwaregore', undefined, '5j23v3']]);
test('comments execRegex', execRegexMatches, execRegexes.comments, [['/r/aww/comments/4ooe2m/', 'aww', '4ooe2m'], ['/r/aww/comments/4ooe2m', 'aww', '4ooe2m'], ['/user/Shitty_Watercolour/comments/63tmon/', 'u_Shitty_Watercolour', '63tmon'], ['/user/Shitty_Watercolour/comments/63tmon', 'u_Shitty_Watercolour', '63tmon'], ['/comments/4ooe2m/', undefined, '4ooe2m'], ['/comments/4ooe2m', undefined, '4ooe2m'], ['/r/softwaregore/comments/5j23v3/handling_of_unicode_characters_ดดด/', 'softwaregore', '5j23v3']]);
test('comments regex shouldn\'t match', regexDoesntMatch, regexes.comments, ['/comments/', '/comments', '/r/reddit.com/comments']);
test('commentsLinklist regex', regexMatches, regexes.commentsLinklist, [['/r/aww/comments', 'r/aww/'], ['/r/aww/comments/', 'r/aww/'], ['/user/Shitty_Watercolour/comments/', 'user/Shitty_Watercolour/'], ['/user/Shitty_Watercolour/comments', 'user/Shitty_Watercolour/'], ['/r/enhancement+resissues/comments', 'r/enhancement+resissues/'], ['/comments', undefined]]);
test('commentsLinklist regex shouldn\'t match', regexDoesntMatch, regexes.commentsLinklist, ['/r/aww/comments/4ooe2m/', '/comments/4ooe2m', '/user/Shitty_Watercolour/comments/63tmon/']);
test('inbox regex', regexMatches, regexes.inbox, [['/message/inbox', undefined], ['/message/unread/', undefined], ['/message/messages/5lohsg', undefined], ['/message/moderator', undefined], ['/r/restests/message/moderator/', 'restests'], ['/r/restests/message/moderator/inbox', 'restests']]);
test('profile regex', regexMatches, regexes.profile, [['/user/-test-', '-test-', undefined], ['/user/example/', 'example', undefined], ['/user/example/submitted', 'example', 'submitted'], ['/user/example/comments/', 'example', 'comments']]);
test('profile regex doesn\'t match', regexDoesntMatch, regexes.profile, ['/user/example/m/res']);
test('profileCommentsPage regex', regexMatches, regexes.profileCommentsPage, [['/user/Shitty_Watercolour/comments/60p3ai/hey_reddit_im_painting_your_favourite_comments/', 'Shitty_Watercolour', '60p3ai'], ['/user/Shitty_Watercolour/comments/63tmon', 'Shitty_Watercolour', '63tmon']]);
test('profileCommentsPage regex doesn\'t match', regexDoesntMatch, regexes.profileCommentsPage, ['/user/example/comments', '/user/example/comments/']);
test('profile2x regex', regexMatches, regexes.profile2x, [['/user/example', 'example', undefined], ['/user/example/', 'example', undefined], ['/user/example/posts', 'example', 'posts'], ['/user/example/posts/', 'example', 'posts'], ['/user/example/comments', 'example', 'comments'], ['/user/example/comments/', 'example', 'comments']]);
test('profile2x regex doesn\'t match', regexDoesntMatch, regexes.profile2x, ['/user/example/m/res']);
test('submit page regex', regexMatches, regexes.submit, [['/submit', undefined], ['/submit/', undefined], ['/r/enhancement/submit', 'enhancement'], ['/r/enhancement+resissues/submit/', 'enhancement+resissues'], ['/r/reddit.com/submit', 'reddit.com']]);
test('prefs regex', regexMatches, regexes.prefs, ['/prefs', '/prefs/apps']);
test('account activity regex', regexMatches, regexes.account, ['/account-activity', '/account-activity/']);
test('wiki regex', regexMatches, regexes.wiki, [['/wiki', undefined], ['/wiki/', undefined], ['/r/enhancement/wiki/', 'enhancement'], ['/r/enhancement/wiki/index', 'enhancement'], ['/r/reddit.com/wiki/index', 'reddit.com']]);
test('stylesheet regex', regexMatches, regexes.stylesheet, [['/r/enhancement/about/stylesheet', 'enhancement'], ['/r/enhancement/about/stylesheet/', 'enhancement'], ['/r/reddit.com/about/stylesheet/', 'reddit.com']]);
test('search regex', regexMatches, regexes.search, ['/search', '/search/', '/r/enhancement+resissues/search', '/r/reddit.com/search', '/r/reddit.com/search', '/user/example/m/res/search', '/me/m/res/search', '/domain/i.redd.it/search', '/domain/imgur.com/search']);
test('comment permalink regex', regexMatches, regexes.commentPermalink, [['/r/aww/comments/4ooe2m/fetch_its_happening/d4eajbv', 'aww', '4ooe2m', 'd4eajbv'], ['/r/aww/comments/4ooe2m/fetch_its_happening/d4eajbv/', 'aww', '4ooe2m', 'd4eajbv'], ['/r/aww/comments/4ooe2m//d4eajbv', 'aww', '4ooe2m', 'd4eajbv'], ['/comments/4ooe2m/fetch_its_happening/d4eajbv', undefined, '4ooe2m', 'd4eajbv'], ['/comments/4ooe2m//d4eajbv', undefined, '4ooe2m', 'd4eajbv'], ['/r/reddit.com/comments/kfwcq/hey_guys_and_gals_just_remember_everythings_going/c35ip60', 'reddit.com', 'kfwcq', 'c35ip60'], ['/r/softwaregore/comments/5j23v3/handling_of_unicode_characters_ดดด/dbdnst0/', 'softwaregore', '5j23v3', 'dbdnst0']]);
test('comment permalink regex doesn\'t match', regexDoesntMatch, regexes.commentPermalink, ['/comments', '/r/aww/comments/4ooe2m/', '/comments/4ooe2m']);
test('duplicate regex', regexMatches, regexes.duplicates, [['/r/aww/duplicates/400e2m', '400e2m']]);
test('subreddit regex', regexMatches, regexes.subreddit, [['/r/Enhancement', 'Enhancement'], ['/r/Enhancement/', 'Enhancement'], ['/r/reddit.com', 'reddit.com'], ['/r/enhancement+resissues', 'enhancement+resissues'], ['/r/de', 'de'] // short (< 3 char) subreddit names
]);
test('subreddit about page regex', regexMatches, regexes.subredditAbout, [['/r/enhancement/about/stylesheet', 'enhancement'], ['/r/enhancement/about/stylesheet/', 'enhancement'], ['/r/reddit.com/about/rules/', 'reddit.com']]);
test('subreddit about page regex doesn\'t match', regexDoesntMatch, regexes.subredditAbout, ['/r/restests/about/modqueue', '/r/restests/about/reports', '/r/restests/about/spam', '/r/restests/about/unmoderated', '/r/restests/about/edited']);
test('modqueue regex', regexMatches, regexes.modqueue, [['/r/restests/about/modqueue', 'restests'], ['/r/restests/about/modqueue/', 'restests'], ['/r/reddit.com/about/modqueue', 'reddit.com'], ['/r/restests/about/reports', 'restests'], ['/r/restests/about/spam', 'restests'], ['/r/restests/about/unmoderated', 'restests'], ['/r/restests/about/edited', 'restests'], ['/r/restests+enhancement/about/edited', 'restests+enhancement']]);
test('multireddit regex', regexMatches, regexes.multireddit, [['/user/example/m/res', 'user/example/m/res'], ['/user/example/m/res/new', 'user/example/m/res'], ['/me/m/res', 'me/m/res'], ['/me/m/res/new', 'me/m/res'], ['/me/f/all', 'me/f/all'], ['/me/f/all/new', 'me/f/all']]);
test('domain regex', regexMatches, regexes.domain, [['/domain/youtube.com', 'youtube.com'], ['/domain/imgur.com/', 'imgur.com']]);
test('compose message regex', regexMatches, regexes.composeMessage, [['/message/compose', undefined], ['/message/compose/', undefined], ['/r/restests/message/compose', 'restests'], ['/r/restests+enhancement/message/compose', 'restests+enhancement'], ['/r/reddit.com/message/compose', 'reddit.com']]);
test('live threads regex', regexMatches, regexes.liveThread, [['/live/xfnm2cpgtxgc', 'xfnm2cpgtxgc'], ['/live/xfnm2cpgtxgc/', 'xfnm2cpgtxgc'], ['/live/xfnm2cpgtxgc/updates/b35a0734-6357-11e6-9c60-0e77456c95c3', 'xfnm2cpgtxgc'], ['/live/xfnm2cpgtxgc/updates/b35a0734-6357-11e6-9c60-0e77456c95c3/', 'xfnm2cpgtxgc'], ['/live/createpgtxgc', 'createpgtxgc']]);
test('liveThread regex doesn\'t match', regexDoesntMatch, regexes.liveThread, ['/live', '/live/', '/live/create', '/live/create/']);