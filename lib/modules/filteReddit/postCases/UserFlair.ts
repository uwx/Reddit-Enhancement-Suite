import { PatternCase } from "../Case";
export class UserFlair extends PatternCase {
  static text = 'User flair';

  static thingToCriterion(thing: any) {
    return thing.getUserFlairText();
  }

  static fields = ['author of this post has flair matching ', {
    type: 'text',
    id: 'patt'
  }];
  static pattern = '[RegEx]';
  trueText = `user flair ${this.conditions.patt}`.trim();
  value = this.build(false, '/./');

  evaluate(thing: any) {
    const text = thing.getUserFlairText();
    return this.value.some(v => v.test(text));
  }

}