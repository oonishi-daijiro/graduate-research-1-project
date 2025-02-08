import sys

sys.platform = "linux"

import threading
import socket
import numpy as np
import cv2
import os
import carplate2json
import traceback

logPrefix = "[carplate2json]\t"
startListenOnce = False


def server():
    try:
        sock = socket.socket(socket.AF_UNIX)
        socketPath = "/tmp/carplate2json_image.sock"
        try:
            os.unlink(socketPath)
        except FileNotFoundError:
            print(f"{logPrefix} no found socket file. just ok.")

        sock.bind(socketPath)
        sock.listen(0)
        print(f"{logPrefix}awaiting request")
        (clientSock, _) = sock.accept()
        threading.Thread(target=server).start()

        carplateType = clientSock.recv(1).decode()
        if len(carplateType) == 1:
            if not (carplateType == "k" or carplateType == "n"):
                raise RuntimeError(
                    f"\nwrong input. carplatype should be k/n but:{carplateType}"
                )
        else:
            raise RuntimeError(
                f"\nwrong input. should input carplatetype first. input was:{carplateType}"
            )
        _ = clientSock.recv(1)  # discard white space.
        print(f"{logPrefix}carplatetype:{carplateType}")
        detectionRect = [""]
        endIndex = 0
        while True:
            c = clientSock.recv(1).decode()
            if c == "\n":
                break
            if c == " ":
                detectionRect.append("")
                endIndex += 1
            else:
                detectionRect[endIndex] += c
        for i in range(len(detectionRect)):
            detectionRect[i] = float(detectionRect[i])

        print(f"{logPrefix}detection rect:")
        print(f"{logPrefix}{detectionRect}")
        buf = np.array([], np.byte)
        imgByteLen = 0

        while True:
            tmp = clientSock.recv(1024)
            imgByteLen += len(tmp)
            print(
                f"\r{logPrefix}total received bytes: {imgByteLen} byte",
                end="",
            )
            if len(tmp) > 0:
                buf = np.append(buf, tmp)
            else:
                print("")
                break
        imgbuf = np.frombuffer(buf, np.byte)
        image = cv2.imdecode(imgbuf, 1)
        (H, W, C) = image.shape
        print(f"{logPrefix}{W}x{H} pixel\t{imgByteLen} byte\t{image.dtype}[{C}]")
        print(f"{logPrefix}OCR to received image")
        jsonDataStr = carplate2json.getCarplateInfoFromImage(
            carimage=image,
            carplateDetectionRect=detectionRect,
            carplateType=carplateType,
        )
        print(f"{logPrefix}result:{jsonDataStr}")
        clientSock.send(jsonDataStr.encode())
        clientSock.close()
        print(f"{logPrefix}done\n\n")
    except Exception as error:
        print(f"{logPrefix}", traceback.format_exc())
        clientSock.send("{}".encode())
        clientSock.shutdown(socket.SHUT_WR)
        clientSock.close()
    return


server()
