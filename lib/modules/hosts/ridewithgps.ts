import { Host } from "../../core/host";
export default new Host('ridewithgps', {
  name: 'ridewithgps',
  domains: ['ridewithgps.com'],
  attribution: false,
  detect: ({
    pathname
  }) => /^\/(trips|routes)\/(\d+)/i.exec(pathname),

  handleLink(href, [, type, id]) {
    return {
      type: 'IFRAME',
      embed: `https://ridewithgps.com/${type}/${id}/embed`
    };
  }

});