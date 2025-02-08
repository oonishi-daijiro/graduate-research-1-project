import express from "express";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

import { CarplateDetectionBound, carplateDetector } from "carplate-detect";
import { carplate2jsonClient, carplate2jsonServer } from "carplate2json";

const app = express();
carplate2jsonServer.launch(`${process.cwd()}/vpython3/bin/python3`);

const server = app.listen(3000);

process.on("exit", () => {
  server.close();
});

process.on("SIGINT", () => {
  server.close();
});

app.use((req, res, next) => {
  console.log("[request] ", req.method, req.path);
  next();
});

app.use(cors());
app.use(express.static("public"));

app.post("/car", (req, res) => {
  let imageSize = Number(req.headers["content-length"] ?? 0);
  const imageBuffer = new Uint8Array(imageSize);
  let beg = 0;

  req.on("data", (chunk: Buffer) => {
    for (let i = 0; i < chunk.length; i++) {
      imageBuffer[beg + i] = chunk[i];
    }
    beg += chunk.length;
  });

  req.on("end", async () => {
    const result = await carplateDetector.detect(imageBuffer);

    if (result.length > 0) {
      const mostConfidentDetection = result.sort((l, r) => {
        if (l.confidence > r.confidence) return 1;
        if (l.confidence == r.confidence) return 0;
        if (l.confidence < r.confidence) return -1;
        return 0;
      })[0];

      if (!mostConfidentDetection) {
        res.write("{}");
        res.end();
      }

      const { top, left, width, height, type } = mostConfidentDetection;

      const cp2jsonCLient = new carplate2jsonClient();

      let t: "k" | "n" | " " = " ";
      if (type == "k-carplate") {
        t = "k";
      } else if (type == "n-carplate") {
        t = "n";
      } else {
        t = "n";
      }
      try {
        const carplateOCRresult = await cp2jsonCLient.sendCarimage({
          type: t,
          image: imageBuffer,
          bound: {
            top: top,
            left: left,
            width: width,
            height: height,
          },
        });
        res.write(carplateOCRresult);
        res.end();
      } catch (error) {
        console.error(error);
        res.write("{}");
        res.end();
      }
    } else {
      res.write("{}");
      res.end();
    }
  });
});
