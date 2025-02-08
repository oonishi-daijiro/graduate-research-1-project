import {
  DetectCustomLabelsCommand,
  RekognitionClient,
} from "@aws-sdk/client-rekognition";
import { AwsCredentialIdentity, Expression } from "@smithy/types";

import * as fs from "fs";
import * as child_process from "child_process";
import path, { resolve } from "path";

const rekognitionCreditional: AwsCredentialIdentity = {
  accessKeyId: process.env.REKOGNITION_ACCESS_KEY!,
  secretAccessKey: process.env.REKOGNITION_SECRET_ACCESS_KEY!,
};

const rekognitionCarplateDetectARN: string =
  process.env.REKOGNITION_CARPLATE_DETECT_ARN!;

const rekognitionClient = new RekognitionClient({
  region: "us-east-1",
  credentials: rekognitionCreditional,
});

export type CarplateDetectionBound = {
  top: number;
  left: number;
  width: number;
  height: number;
  confidence: number;
  type: "k-carplate" | "n-carplate" | "";
};

const ErrorDetectionBound: CarplateDetectionBound = {
  width: -1,
  height: -1,
  top: -1,
  left: -1,
  confidence: -1,
  type: "",
};

async function detectCarplates(
  imgByte: Uint8Array
): Promise<CarplateDetectionBound[]> {
  try {
    if (
      !rekognitionCreditional.accessKeyId ||
      !rekognitionCreditional.secretAccessKey ||
      !rekognitionCarplateDetectARN
    ) {
      throw new Error("cannnot read property to use Rekognition.");
    }

    const command = new DetectCustomLabelsCommand({
      ProjectVersionArn: rekognitionCarplateDetectARN,
      Image: {
        Bytes: imgByte,
      },
      MaxResults: 50,
      MinConfidence: 50,
    });
    const result = await rekognitionClient.send(command);
    if (!result.CustomLabels) {
      throw new Error("error on reading rekognition response.");
    }
    const detectionBounds = result.CustomLabels?.map(
      (e): CarplateDetectionBound => {
        if (e.Geometry?.BoundingBox) {
          const { Top, Height, Width, Left } = e.Geometry?.BoundingBox;
          const confidence = e.Confidence;
          if (!Top || !Height || !Width || !Left || !confidence) {
            return ErrorDetectionBound;
          }

          return {
            top: Top,
            height: Height,
            width: Width,
            left: Left,
            confidence: confidence,
            type: (e.Name as "") ?? "",
          };
        } else {
          return ErrorDetectionBound;
        }
      }
    );
    return detectionBounds;
  } catch (err) {
    console.log(err);
    return [];
  }
}

function sleep(time: number): Promise<void> {
  return new Promise<void>((_) => {
    setTimeout(() => {
      _();
    }, time);
  });
}

async function detecFromImageDir(
  imageDir: string
): Promise<[string, CarplateDetectionBound[]][]> {
  const images = fs.readdirSync(imageDir).reduce((accum, current): string[] => {
    if (path.extname(current) === ".png") {
      return [...accum, `${imageDir}/${current}`];
    } else {
      return accum;
    }
  }, [] as string[]);
  let progress = 0;

  const result = await images.reduce(
    async (accum, path): Promise<[string, CarplateDetectionBound[]][]> => {
      const ac = await accum;
      const result = await detectFromPath(path);
      progress++;
      process.stdout.write(
        `detecting carplates. [${progress}/${images.length}]\r`
      );

      return [...ac, [path, result]];
    },
    new Promise<[string, CarplateDetectionBound[]][]>((_) => _([]))
  );

  console.log("\ndone.");

  return result;
}

async function detectFromPath(
  path: string
): ReturnType<typeof detectCarplates> {
  const file = fs.readFileSync(path);
  return detectCarplates(file);
}

function showDetectionResult(
  results: [string, CarplateDetectionBound[]][],
  getInput = false
): string {
  let input = "";
  input += `${results.length}\n`;
  results.map((result) => {
    const [imagepath, bounds] = result;
    input += `${path.resolve(imagepath, "./")}\n`;
    input += `${bounds.length}\n`;
    bounds.forEach((detectionResult) => {
      const { left, top, width, height, confidence } = detectionResult;
      input += `${left} ${top} ${width} ${height} ${confidence}\n`;
    });
  });
  try {
    const child = child_process.spawn(
      path.resolve(`${__dirname}/../bin/draw-detection-bound.exe`)
    );
    child.stdout.pipe(process.stdout);
    child.stdin.write(input);
    child.stdin.end();
    if (getInput) {
      return input;
    } else {
      return "";
    }
  } catch (error) {
    console.error(error);
    return "";
  }
}

export const carplateDetector = {
  detect: detectCarplates,
  detectFromPath: detectFromPath,
  detectFromImageDir: detecFromImageDir,
  showDetectionResult: showDetectionResult,
};
