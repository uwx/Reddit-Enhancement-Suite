import { Case } from "../Case";
export class IsSpoiler extends Case {
  static text = 'Spoiler';
  static fields = ['post is marked spoiler'];
  static unique = true;
  trueText = 'spoiler';

  evaluate(thing: any) {
    return thing.isSpoiler();
  }

}