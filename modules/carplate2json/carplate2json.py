import sys

import cv2
import pytesseract
import numpy as np
from PIL import Image
import glob
import json


def cv2pil(image):
    new_image = image.copy()
    if new_image.ndim == 2:
        pass
    elif new_image.shape[2] == 3:
        new_image = cv2.cvtColor(new_image, cv2.COLOR_BGR2RGB)
    elif new_image.shape[2] == 4:
        new_image = cv2.cvtColor(new_image, cv2.COLOR_BGRA2RGBA)
    new_image = Image.fromarray(new_image)
    return new_image


def scale_rectangle(list_rect, s):
    [x, y, w, h] = list_rect
    newWidth = w * s
    newHeight = h * s

    centerX = x + w / 2
    centerY = y + h / 2

    newX = centerX - newWidth / 2
    newY = centerY - newHeight / 2

    return [newX, newY, newWidth, newHeight]


def resizeForOCR(image):
    (H, W, _) = image.shape
    newSize = (W, H)
    if W > H:
        width = 1024
        height = int((H / W) * width)
        newSize = (width, height)
    else:
        height = 768
        width = int((W / H) * height)
        newSize = (width, height)
    return cv2.resize(image, newSize)


def dilate(image, k=3):
    kernel = np.ones((k, k), np.uint8)
    return cv2.dilate(image, kernel)


def erode(image, k=3):
    kernel = np.ones((k, k), np.uint8)
    return cv2.erode(image, kernel)


def composition(i, *funcList):
    for func in funcList:
        i = func(i)
    return i


def cnvImageWellOCR(image):
    image = resizeForOCR(image)
    image = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    _, image = cv2.threshold(image, 120, 255, cv2.THRESH_BINARY)
    image = composition(image, erode, dilate, erode, dilate)
    return cv2pil(image)


def getAviableCharacters(ocrType):
    aviableCharacters = ""
    with open("./available_characters.json") as jsonFile:
        availables = json.load(jsonFile)
        if ocrType == "serialNumber":
            aviableCharacters = availables["serialNumber"]
        elif ocrType == "transportID":
            aviableCharacters = availables["transportID"]
        elif ocrType == "carUsage":
            aviableCharacters = availables["carUsage"]
    return aviableCharacters


def ocrSerialNumber(image):
    inputImg = cnvImageWellOCR(image)
    avilableChars = getAviableCharacters("serialNumber")
    rawStr = str(
        pytesseract.image_to_string(
            inputImg,
            lang="eng",
            config=f"--psm 7 -c tessedit_char_whitelist={avilableChars}",
        )
    )
    return rawStr.replace(" ", "").replace("\n", "")


def ocrTransportID(image):
    inputImg = cnvImageWellOCR(image)
    avilableChars = getAviableCharacters("transportID")
    rawStr = str(
        pytesseract.image_to_string(
            inputImg,
            lang="eng+carplate",
            config=f'--psm 7 -c tessedit_char_whitelist="{avilableChars}"',
        )
    )
    return rawStr.replace(" ", "").replace("\n", "")


def ocrCarUsage(image):
    inputImg = cnvImageWellOCR(image)
    avilableChars = getAviableCharacters("carUsage")
    rawStr = str(
        pytesseract.image_to_string(
            inputImg,
            lang="carplate",
            config=f'--psm 10 -c tessedit_char_whitelist="{avilableChars}"',
        )
    )
    return rawStr.replace(" ", "").replace("\n", "")


def imshowpp(image):

    cv2.imshow("imshowpp", image)
    cv2.moveWindow("imshowpp", int(1920 / 4), int(1080 / 4))
    if cv2.waitKey() == 27:
        exit()
    #   raise RuntimeError("canceled by user.")


def cropCarplateFromImageByDetectionBound(
    rawCarplateRec, carImage, carplateType, showImage=False
):
    origin = carImage.copy()
    (H, W, _) = carImage.shape

    carplateRec = [
        int(rawCarplateRec[0] * W),
        int(rawCarplateRec[1] * H),
        int(rawCarplateRec[2] * W),
        int(rawCarplateRec[3] * H),
    ]

    for i in range(len(carplateRec)):
        carplateRec[i] = int(carplateRec[i])

    [x, y, width, height] = carplateRec
    print(x, y, width, height)

    carImage = carImage[
        y : y + height,
        x : x + width,
    ]

    origin = origin[
        y : y + height,
        x : x + width,
    ]

    if showImage:
        imshowpp(carImage)

    carImage = cv2.cvtColor(carImage, cv2.COLOR_BGR2HSV)
    if showImage:
        imshowpp(carImage)

    lower = []
    upper = []

    if carplateType == "n":
        # white HSV range
        lower = np.array([0, 0, 150])
        upper = np.array([256, 255, 255])
    elif carplateType == "k":
        # yellow HSV range
        lower = np.array([20, 0, 0])
        upper = np.array([50, 255, 255])

    mask = cv2.inRange(carImage, lower, upper)
    if showImage:
        imshowpp(carImage)

    carImage = cv2.cvtColor(carImage, cv2.COLOR_HSV2BGR)
    carImage = cv2.cvtColor(carImage, cv2.COLOR_BGR2GRAY)

    if showImage:
        imshowpp(carImage)

    carImage = cv2.bitwise_and(carImage, mask)
    if showImage:
        imshowpp(carImage)

    carImage = composition(
        carImage,
        erode,
        dilate,
        erode,
        dilate,
        erode,
        dilate,
    )

    img_blur = cv2.blur(carImage, (5, 5))
    if showImage:
        imshowpp(carImage)

    med_val = np.median(img_blur)
    sigma = 0.33  # 0.33
    min_val = int(max(0, (1.0 - sigma) * med_val))
    max_val = int(max(255, (1.0 + sigma) * med_val))

    carImage = cv2.Canny(carImage, min_val, max_val)
    #  carImage = cv2.Laplacian(carImage, cv2.CV_8U, ksize=3)

    if showImage:
        imshowpp(carImage)

    contours, _ = cv2.findContours(carImage, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    sortedCotours = sorted(contours, key=cv2.contourArea, reverse=True)[:10]

    carplateAngledBound = []
    found = False

    for contour in sortedCotours:
        epsilon = 0.1 * cv2.arcLength(contour, True)
        approx = cv2.approxPolyDP(contour, epsilon, True)

        if len(approx) == 4:
            carplateAngledBound = approx
            found = True
        break

    if not found:
        return origin

    width = 1000
    height = int(width / 1.8)

    srcPt = np.array(carplateAngledBound, dtype=np.float32)
    dstPt = np.array(
        [[width, 0], [0, 0], [0, height], [width, height]], dtype=np.float32
    )

    cv2.getPerspectiveTransform(srcPt, dstPt)
    M = cv2.getPerspectiveTransform(srcPt, dstPt)

    sub_image = cv2.warpPerspective(origin, M, (width, height))

    return sub_image


# return disassemblied carplate image.
# this separates carplate image into 4 parts.
# returns as tuple below order.
# [0] : transport breau number and type of car(運輸支局-自動車種別) in japanese. example: 富山 581. call this data as transport ID in this section.
# [1] : usage of car(自動車用途) in japanese. example: つ
# [2] : serial number(一連指定番号) in japanese. example: 19-68


def disasmCarplate(carplateImage):
    sepRelCoord = (0.2, 0.4)
    (H, W, _) = carplateImage.shape
    [sepRelCoordX, sepRelCoordY] = sepRelCoord
    tbnnt = carplateImage[0 : int(sepRelCoordY * H), 0:W]
    carUsage = carplateImage[int(sepRelCoordY * H) : H, 0 : int(sepRelCoordX * W)]
    serialNumber = carplateImage[int(sepRelCoordY * H) : H, int(sepRelCoordX * W) : W]
    return [tbnnt, carUsage, serialNumber]


def getCarplateInfoFromImage(carimage, carplateDetectionRect, carplateType):
    carplateImg = cropCarplateFromImageByDetectionBound(
        carImage=carimage,
        rawCarplateRec=carplateDetectionRect,
        carplateType=carplateType,
        showImage=False,
    )
    [tpIDImage, usageImage, serialNumImage] = disasmCarplate(carplateImg)

    carplate = {
        "transportID": ocrTransportID(tpIDImage),
        "usage": ocrCarUsage(usageImage),
        "serialNumber": ocrSerialNumber(serialNumImage),
    }
    return json.dumps(carplate, ensure_ascii=False)
