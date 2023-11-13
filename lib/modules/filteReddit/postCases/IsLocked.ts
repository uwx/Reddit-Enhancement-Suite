import { Case } from "../Case";
export class IsLocked extends Case {
  static text = 'Locked';
  static fields = ['post is locked'];
  static unique = true;
  trueText = 'locked';

  evaluate(thing: any) {
    return thing.isLocked();
  }

}