import { Host } from "../../core/host";
export default new Host('jsfiddle', {
  name: 'jsfiddle',
  domains: ['jsfiddle.net'],
  logo: 'https://jsfiddle.net/favicon.png',
  detect: ({
    pathname
  }) => /^(\/(?:\w+\/(?!embedded\/))?[a-z0-9]{5,}(?:\/\d+)?(?=\/|$))(\/embedded\/[\w,]+\/)?/i.exec(pathname),

  handleLink(href, [, path, categories]) {
    return {
      type: 'IFRAME',
      expandoClass: 'selftext',
      muted: true,
      embed: `https://jsfiddle.net${path}${categories || '/embedded/result,js,resources,html,css/'}`,
      width: '800px',
      height: '500px'
    };
  }

});