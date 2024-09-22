"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
function activate(context) {
    // 注册命令，通过命令面板启动插件
    const disposable = vscode.commands.registerCommand('imagesviewer.openFolder', async () => {
        // 打开文件夹选择器
        const folderUri = await vscode.window.showOpenDialog({
            canSelectFolders: true,
            canSelectMany: false,
            openLabel: 'Select Image Folder'
        });
        if (folderUri && folderUri[0]) {
            const folderPath = folderUri[0].fsPath;
            // 读取文件夹中的所有图片文件
            fs.readdir(folderPath, (err, files) => {
                if (err) {
                    vscode.window.showErrorMessage('Error reading folder');
                    return;
                }
                console.log('Files in folder:', files); // 调试信息：打印文件夹中的文件列表
                const imageFiles = files.filter(file => isImageFile(file));
                if (imageFiles.length === 0) {
                    vscode.window.showInformationMessage('No images found in the selected folder');
                    return;
                }
                // 创建一个 WebView 面板显示图片
                const panel = vscode.window.createWebviewPanel('imageViewer', 'Image Viewer', vscode.ViewColumn.One, {
                    enableScripts: true // 允许在 WebView 中执行 JavaScript
                });
                // 将 HTML 内容加载到 WebView 中
                panel.webview.html = getWebviewContent(imageFiles, folderPath, panel);
            });
        }
    });
    context.subscriptions.push(disposable);
}
// 检查文件是否为图片
function isImageFile(file) {
    const ext = path.extname(file).toLowerCase();
    return ['.png', '.jpg', '.jpeg', '.gif', '.bmp'].includes(ext);
}
// 获取 WebView 的 HTML 内容
function getWebviewContent(imageFiles, folderPath, panel) {
    const imagePaths = imageFiles.map(file => panel.webview.asWebviewUri(vscode.Uri.file(path.join(folderPath, file))).toString());
    console.log('Images:', imagePaths); // 调试信息：打印图片的路径
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Image Viewer</title>
        <style>
            body {
                margin: 0;
                padding: 0;
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
                background-color: #333;
            }
            img {
                max-width: 100%;
                max-height: 100%;
            }
        </style>
    </head>
    <body>
        <img id="imageElement" src="${imagePaths[0]}" />
        <script>
            let imageIndex = 0;
            const images = ${JSON.stringify(imagePaths)};
            const imageElement = document.getElementById('imageElement');

            // 使用左右方向键浏览图片
            document.addEventListener('keydown', function(event) {
                if (event.key === 'ArrowRight') {
                    imageIndex = (imageIndex + 1) % images.length;
                    imageElement.src = images[imageIndex];
                } else if (event.key === 'ArrowLeft') {
                    imageIndex = (imageIndex - 1 + images.length) % images.length;
                    imageElement.src = images[imageIndex];
                }
            });
        </script>
    </body>
    </html>
    `;
}
function deactivate() { }
//# sourceMappingURL=extension.js.map