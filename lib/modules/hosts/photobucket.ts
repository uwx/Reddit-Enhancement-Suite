import { Host } from "../../core/host";
import { ajax } from "../../environment";
export default new Host('photobucket', {
  name: 'photobucket',
  domains: ['photobucket.com'],
  logo: 'https://pic2.pbsrc.com/common/favicon.ico',
  detect: ({
    href
  }) => /([is]?)[0-9]+|media|smg|img(?=.photobucket.com)/i.exec(href),

  async handleLink(href, [, prefix]) {
    let src = href.replace('.html', '');

    // user linked direct image so no need to hit API
    if (prefix !== 'i') {
      const {
        imageUrl
      } = await ajax({
        url: 'https://api.photobucket.com/v2/media/fromurl',
        query: {
          url: src
        },
        type: 'json'
      });
      src = imageUrl.replace('http:', 'https:');
    }

    return {
      type: 'IMAGE',
      src
    };
  }

});