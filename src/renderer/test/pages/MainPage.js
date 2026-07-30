import { BodySection } from './sections/BodySection';
import { FooterSection } from './sections/FooterSection';
import { ToolBarSection } from './sections/ToolBarSection';

export class MainPage {
  constructor() {
    this.body = new BodySection();
    this.menu = new ToolBarSection();
    this.footer = new FooterSection();
  }

  assertMatches(expectation) {
    this.body.assertMatches(expectation.body);
    this.menu.assertMatches(expectation.menu);
    this.footer.assertMatches(expectation.footer);
  }
}




