import * as child_process from "child_process";
import { log } from "console";
import * as fs from "fs";
import * as path from "path";

const carplates = fs
  .readdirSync(`${process.cwd()}/carplate`)
  .filter((fname) => {
    if (path.extname(fname) == ".png") {
      return true;
    } else {
      false;
    }
  });

carplates.forEach((cpFname) => {
  try {
    console.log(cpFname);
    child_process.execSync(
      `curl localhost:80/car -X POST --data-binary "@${process.cwd()}/carplate/${cpFname}" -s`,
      { stdio: "inherit" }
    );
    console.log("\n");
  } catch (error) {
    // console.log(error);
  }
});
