import { PatternCase } from "../Case";
export class Username extends PatternCase {
  static text = 'Username';

  static thingToCriterion(thing: any) {
    return thing.getAuthor();
  }

  static fields = ['posted by /u/', {
    type: 'text',
    id: 'patt'
  }];
  trueText = `by ${this.conditions.patt}`;
  value = this.build(true);

  evaluate(thing: any) {
    const user = thing.getAuthor();
    if (!user) return null;
    return this.value.some(v => v.test(user));
  }

}