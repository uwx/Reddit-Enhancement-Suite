import { Host } from "../../core/host";
export default new Host('bime', {
  name: 'Bime Analytics Dashboards',
  domains: ['bime.io'],
  logo: 'https://a.bime.io/assets/favicons/favicon.ico',
  detect: ({
    href
  }) => /https?:\/\/([^.]+)\.bime\.io(?:\/([a-z0-9_-]+))+/i.exec(href),
  handleLink: (href, [, user, dashboardId]) => ({
    type: 'IFRAME',
    embed: `https://${user}.bime.io/dashboard/${dashboardId}`,
    expandoClass: 'selftext',
    width: '960px',
    height: '540px'
  })
});