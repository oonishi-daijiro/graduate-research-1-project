import { Camera, Proportions, VideoOff, X } from 'lucide-react';
import * as React from 'react';
import * as ReactDOM from 'react-dom/client'
import { Alert, AlertDescription } from "./alert"

const root = document.createElement('div')
document.body.appendChild(root);
const ReactAppRoot = ReactDOM.createRoot(root);

const App: React.FC = () => {
   return <NumberplateMngConsole></NumberplateMngConsole>
}

type carplate = {
   transportID: string,
   serialNumber: string,
   usage: string
   isRegistered: boolean
};

type RecognitionServerState = "pending" | "ready" | "done" | "notready";



const NumberplateMngConsole: React.FC = () => {
   const defaultCarplate: carplate = {
      transportID: "富山581",
      serialNumber: "あ",
      usage: "4649",
      isRegistered: true
   };

   const [videoSource, setVideoSource] = React.useState<MediaStream>(null);
   const [image, setImage] = React.useState<ArrayBuffer>();
   const [imageURL, setImageURL] = React.useState("");
   const [error, setError] = React.useState<string>("");
   const [recognitionState, setRecognitionSate] = React.useState<"notready" | "pending" | "ready" | "done">("ready");
   const [currentCarplate, setCurrentCarplate] = React.useState(defaultCarplate);


   const videoRef = React.useRef<HTMLVideoElement>(null);

   const [files, getFiles] = useFiles('image/png');

   React.useEffect(() => {
      if (videoSource && videoRef.current) {
         videoRef.current.srcObject = videoSource;
      }
   }, [videoSource]);

   const handleOnclickActivateCamera = async () => {
      try {
         const stream = await navigator.mediaDevices.getUserMedia({
            video: {
               facingMode: 'environment', // rear cam:high priority
               width: { ideal: 1280 },
               height: { ideal: 720 }
            }
         });
         setVideoSource(stream);
      } catch (err) {
         console.error('Camera error:', err);
         setError('カメラへのアクセスに失敗しました: ' + err.message);
         setVideoSource(null);
      }
   };

   React.useEffect(() => {
      return () => {
         if (videoSource) {
            videoSource.getTracks().forEach((track) => track.stop());
         }
      }
   }, []);

   const handleOnclickCaptureImage = async () => {
      if (videoRef.current) {
         const { videoWidth, videoHeight } = videoRef.current;
         const canvas = document.createElement("canvas");
         const context = canvas.getContext('2d');
         canvas.width = videoWidth;
         canvas.height = videoHeight;
         context.drawImage(videoRef.current, 0, 0, videoWidth, videoHeight);
         const capturedImageBlob = await new Promise<Blob>((resolve) => canvas.toBlob((blob) => resolve(blob), 'image/png'));

         if (capturedImageBlob) {
            setImage(await capturedImageBlob.arrayBuffer());
            setImageURL(URL.createObjectURL(capturedImageBlob));
         }
      }
   };

   const handleOnclickRecaptureImage = () => {
      if (recognitionState != 'pending') {
         setImage(null);
         if (imageURL.length > 0) URL.revokeObjectURL(imageURL);
         setImageURL("");
      }
   };

   const handleSetImageFromFile = () => {
      getFiles();
   };

   const setCarimagefile = async () => {
      if (!files) return

      if (files.length == 1) {
         const carimage = files[0];
         const imgBlob = new Blob([carimage], { "type": 'image/png' });
         const imgBuf = await imgBlob.arrayBuffer();
         setImage(imgBuf);
         setImageURL(URL.createObjectURL(imgBlob));
      }
   }

   React.useEffect(() => {
      setCarimagefile();
   }, [files]);

   const sendImage = async () => {
      if (image) {
         try {
            setRecognitionSate('pending');
            const res = await fetch(`/car`, {
               method: "POST", body: image
            })
            setRecognitionSate('done')
            const resObj = await res.json();
            console.log(resObj);
            setCurrentCarplate(resObj as unknown as carplate);
         } catch (error) {
            setError(error);
         }
      }
   }

   React.useEffect(() => {
      sendImage();
   }, [image]);

   return (
      <div className="max-w-2xl mx-auto p-4">
         <h1 className="text-2xl font-bold mb-6">ナンバープレート認識システム</h1>
         <div className="space-y-4">
            <AlertWrapper error={error}></AlertWrapper>
            <div className="relative aspect-video bg-gray-100 rounded-lg overflow-hidden">
               {
                  imageURL.length > 0 ?
                     <img src={imageURL} className="w-full h-full object-cover" /> :
                     <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        className="w-full h-full object-cover"
                     />
               }
            </div>
            <div className="flex justify-center gap-4">
               <ButtonActivateCamera onClick={handleOnclickActivateCamera} />
               <ButtonCaptureImage onClick={handleOnclickCaptureImage} />
               <ButtonOpenFile onClick={handleSetImageFromFile} />
               <ButtonRecaptureImage onClick={handleOnclickRecaptureImage} />
            </div>
            <NumberRecognitionDisplay carplate={currentCarplate} recognitionSatte={recognitionState} />
         </div>
      </div>
   )
}

ReactAppRoot.render(<App />);

type ClickProps = {
   onClick: () => void
};

const ButtonActivateCamera: React.FC<ClickProps> = (props) => {
   return (<button
      {...props}
      className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
   >
      <Camera size={20} />
      カメラを起動
   </button>)
};

const ButtonCaptureImage: React.FC<ClickProps> = (props) => {
   return (
      <button
         {...props}
         className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600">
         撮影
      </button>
   )
};

const ButtonRecaptureImage: React.FC<ClickProps> = (props) => {

   return (
      <button
         {...props}
         className="flex items-center gap-2 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
      >
         <X size={20} />
         やり直し
      </button>
   )
};

const ButtonOpenFile: React.FC<ClickProps> = (props) => {
   return (
      <button
         {...props}
         className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600">
         ファイルから
      </button>
   )
}



const AlertWrapper: React.FC<{ error: string }> = ({ error = "" }) => {
   if (error == "") {
      return <></>
   } else {
      return (
         <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
         </Alert>
      )
   }

}

const NumberRecognitionDisplay: React.FC<{ carplate: carplate, recognitionSatte: RecognitionServerState }> = ({ carplate, recognitionSatte }) => {
   switch (recognitionSatte) {
      case 'pending':
         return (
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
               <h2 className="text-xl font-semibold mb-2">認識中....</h2>
            </div>
         )
      case 'ready':
         return <></>
      case 'done':
         return (
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
               <h2 className="text-xl font-semibold mb-2">認識結果</h2>
               <p className="text-lg mb-2">{carplate.transportID} {carplate.usage} {carplate.serialNumber}</p>
               <p className={`text-lg ${carplate.isRegistered ? 'text-green-600' : 'text-red-600'}`}>
                  ステータス: {carplate.isRegistered ? '登録済み' : '未登録'}
               </p>
            </div>
         )
      case 'notready':
         return <></>
      default:
         return <>this should not be shown</>
   }
}

const CarimageDisplayImpl: React.FC<{ ref: React.RefObject<HTMLVideoElement>, input: "video" | "image" }> = () => {
   return (<></>);

}

function useFiles(whiteExtList: string): [FileList, () => void] {
   const fileInputRef = React.useRef<HTMLInputElement>(null);
   const [files, setFiles] = React.useState<FileList>(null);

   React.useEffect(() => {
      const fileInput = document.createElement('input')
      fileInput.style.display = 'none'
      fileInput.type = "file"
      fileInput.accept = whiteExtList;

      interface FileinputChangeEvent extends Event {
         currentTarget: Event['currentTarget'] & { files: FileList }
      }
      fileInput.addEventListener('change', (e: FileinputChangeEvent) => {
         const files = e.currentTarget.files;
         setFiles(files);
      })
      fileInputRef.current = fileInput;
   }, []);

   const getFile = () => {
      if (fileInputRef.current) {
         fileInputRef.current.click();
      }
   }

   return [files, getFile]
}
