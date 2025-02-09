# 卒業研究１ プロジェクト
車の写真を撮り，ナンバープレートの情報を読み取ります．
## インストール
### 必要ライブラリ
`python，nodejs，tesseract-ocr`が
ない場合はインストールをお願いします．

### configure
Node.jsの依存関係の解決，Python仮想環境の構築，Python仮想環境への必要モジュールインストールを行います．
```
git clone https://github.com/oonishi-daijiro/graduate-research-1-project && cd graduate-research-1-project
```

```
./configure
```

### 起動
```
npm run start
```
`permission error`が発生する場合`sudo`による実行が必要です．

## 動作確認済み環境
WSL2 ubuntu (20.04.6 LTS (Focal Fossa))  
Node.js v22.13.1  
npm 10.9.2  
python 3.8.10  
python3仮想環境 3.8.10  
