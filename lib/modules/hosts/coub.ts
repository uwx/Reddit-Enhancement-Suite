import { Host } from "../../core/host";
export default new Host('coub', {
  name: 'Coub',
  domains: ['coub.com'],
  detect: ({
    pathname
  }) => /^\/(?:view|embed)\/(\w+)(\.gifv)?/i.exec(pathname),

  handleLink(href, [, hash, isGifv]) {
    const src = isGifv ? `https://coub.com/view/${hash}.gifv?res=true` : `https://coub.com/embed/${hash}?autoplay=true&res=true`;
    return {
      type: 'IFRAME',
      muted: !!isGifv,
      embed: src,
      fixedRatio: true
    };
  }

});