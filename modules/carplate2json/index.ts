import * as child_proceess from "child_process";
import * as net from "net";
import * as path from "path";

process.env.TESSDATA_PREFIX = path.resolve(__dirname, "../tessdata");

type carplate2jsonServer = {
  jsonServerProcess: child_proceess.ChildProcess | null;
  launched: boolean;
  launch(pythonAbsPath: string): Promise<void>;
  kill(): void;
};

export const carplate2jsonServer: carplate2jsonServer = {
  launched: false,
  jsonServerProcess: null,

  launch: (pythonAbsPath: string) => {
    try {
      if (!carplate2jsonServer.launched) {
        carplate2jsonServer.jsonServerProcess = child_proceess.spawn(
          pythonAbsPath,
          ["-u", `carplate2jsonServer.py`],
          { cwd: `${path.resolve(__dirname, "../")}` }
        );

        carplate2jsonServer.jsonServerProcess.stdout?.pipe(process.stdout);
        carplate2jsonServer.jsonServerProcess.stderr?.pipe(process.stderr);

        carplate2jsonServer.jsonServerProcess.on("error", (error) => {
          console.log("error:", error.message);
          carplate2jsonServer.launched = false;
        });

        carplate2jsonServer.launched = true;
      }
      return new Promise<void>((resolve, reject) => {
        if (carplate2jsonServer.jsonServerProcess) {
          carplate2jsonServer.jsonServerProcess.stdout?.on("data", (data) => {
            resolve();
          });
        } else {
          reject("server instance is not set");
        }
      });
    } catch (error) {
      carplate2jsonServer.jsonServerProcess = null;
      carplate2jsonServer.launched = false;
      console.error(error);
      return new Promise((_, reject) => reject("failed to launch server"));
    }
  },

  kill: () => {
    if (carplate2jsonServer.launched) {
      process.kill(carplate2jsonServer.jsonServerProcess?.pid!);
      carplate2jsonServer.launched = false;
    }
  },
};

process.on("exit", carplate2jsonServer.kill);
process.on("SIGINT", carplate2jsonServer.kill);

type carplate2jsonInput = {
  type: "n" | "k";
  bound: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
  image: Uint8Array;
};

export class carplate2jsonClient {
  private socket: net.Socket;

  constructor() {
    this.socket = net.connect("/tmp/carplate2json_image.sock");
  }

  sendCarimage(data: carplate2jsonInput) {
    const { type, bound, image } = data;
    const { top, left, width, height } = bound;
    this.socket.write(`${type} ${left} ${top} ${width} ${height}\n`);
    this.socket.write(image);
    this.socket.end();

    let jsonResponse = "";
    const result = new Promise<string>((resolve, reject) => {
      this.socket.on("data", (chunk) => {
        jsonResponse += chunk;
      });

      this.socket.on("end", () => {
        resolve(jsonResponse);
      });

      this.socket.on("error", (error) => {
        reject(error);
      });
    });
    return result;
  }
}
