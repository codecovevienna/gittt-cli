#!/usr/bin/env node

import { App } from "./app";

(async (): Promise<void> => {
  const app: App = new App();
  await app.setup();
  app.start();
})();
