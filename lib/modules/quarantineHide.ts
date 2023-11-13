import $ from "jquery";
import { Module } from "../core/module";
import { BodyClasses, frameThrottle, inQuarantinedSubreddit, watchForThings } from "../utils";
export const module: Module<any> = new Module('quarantineHide');
module.moduleName = 'quarantineHideName'; // i18n

module.category = 'appearanceCategory';
module.description = 'quarantineHideDesc'; // i18n

module.options = {
  hideFlair: {
    title: 'quarantineHideFlairTitle',
    // i18n
    type: 'boolean',
    value: false,
    description: 'quarantineHideFlairDesc' // i18n

  },
  hideQuarantinedInSub: {
    title: 'quarantineHideInSubTitle',
    // i18n
    type: 'boolean',
    value: false,
    description: 'quarantineHideInSubDesc' // i18n

  }
};
module.include = ['linklist', 'comments', 'wiki'];

module.contentStart = () => {
  if (module.options.hideFlair.value) {
    watchForThings(['post'], frameThrottle(() => {
      $('.quarantine-stamp').parent().remove();
    }));
  }

  if (inQuarantinedSubreddit() && module.options.hideQuarantinedInSub.value) {
    BodyClasses.remove('quarantine');
    $('.quarantine-notice').hide();
  }
};