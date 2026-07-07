import { BodyArea } from './BodyArea';
import { FooterBar } from './FooterBar';
import { MenuBar } from './MenuBar';

export class MainPage {
  constructor() {
    this.body = new BodyArea();
    this.menu = new MenuBar();
    this.footer = new FooterBar();
  }

  assertMatches(expectation) {
    this.body.assertMatches(expectation.body);
    this.menu.assertMatches(expectation.menu);
    this.footer.assertMatches(expectation.footer);
  }
}




