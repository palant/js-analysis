/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

"use strict";

import fs from "fs";
import path from "path";

import {expect} from "chai";
import Mocha from "mocha";

const mocha = new Mocha();

async function run()
{
  const __dirname = path.dirname(new URL(import.meta.url).pathname);
  let dir = path.join(__dirname, "test");
  let files = fs.readdirSync(dir);
  for (let file of files)
    if (file.endsWith(".js"))
      mocha.addFile(path.join(dir, file));

  await mocha.loadFilesAsync();

  global.expect = expect;
  mocha.run(function(failures) {
    process.on("exit", function() {
      process.exit(failures > 0 ? 1 : 0);
    });
  });
}
run();
