import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {
    const openFolderCmd = vscode.commands.registerCommand('imagesviewer.openFolder', async () => {
        const folderUri = await vscode.window.showOpenDialog({
            canSelectFolders: true,
            canSelectMany: false,
            openLabel: 'Select Image Folder'
        });

        if (folderUri && folderUri[0]) {
            openImageFolder(folderUri[0]);
        }
    });

    const openFromExplorerCmd = vscode.commands.registerCommand('imagesviewer.openFolderFromExplorer', (uri: vscode.Uri) => {
        openImageFolder(uri);
    });

    context.subscriptions.push(openFolderCmd, openFromExplorerCmd);
}

function openImageFolder(folderUri: vscode.Uri) {
    const folderPath = folderUri.fsPath;

    fs.readdir(folderPath, (err, files) => {
        if (err) {
            vscode.window.showErrorMessage('Error reading folder');
            return;
        }

        const imageFiles = files.filter(file => isImageFile(file));
        if (imageFiles.length === 0) {
            vscode.window.showInformationMessage('No images found in the selected folder');
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'imageViewer',
            'Image Viewer',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        panel.webview.options = {
            enableScripts: true,
            localResourceRoots: [vscode.Uri.file(folderPath)]
        };

        panel.webview.html = getWebviewContent(imageFiles, folderPath, panel, 0, 1);

        // 监听 WebView 的消息
        panel.webview.onDidReceiveMessage(message => {
            if (message.command === 'saveState') {
                // 这里可以处理从 WebView 传来的消息，插件本身不需要 `setState` 和 `getState`
                console.log(`Image Index: ${message.state.imageIndex}, Zoom Level: ${message.state.zoomLevel}`);
            }
        });
    });
}

function isImageFile(file: string): boolean {
    const ext = path.extname(file).toLowerCase();
    return ['.png', '.jpg', '.jpeg', '.gif', '.bmp'].includes(ext);
}

// 获取 WebView 的 HTML 内容
function getWebviewContent(imageFiles: string[], folderPath: string, panel: vscode.WebviewPanel, initialIndex: number, initialZoom: number) {
    const imagePaths = imageFiles.map(file => panel.webview.asWebviewUri(vscode.Uri.file(path.join(folderPath, file))).toString());
    const imageNames = imageFiles.map(file => path.basename(file));

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
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                    height: 100vh;
                    background-color: #333;
                    color: white;
                    font-family: Arial, sans-serif;
                    overflow: hidden;
                }
                #imageCounter {
                    position: fixed;
                    top: 10px;
                    width: 100%;
                    text-align: center;
                    font-size: 16px;
                    z-index: 1;
                }
                img {
                    max-width: 90%;
                    max-height: 90%;
                    transition: transform 0.2s ease;
                    cursor: default; /* 始终保持为箭头样式 */
                }
                #imageName {
                    position: fixed;
                    bottom: 50px;
                    width: 100%;
                    text-align: center;
                    font-size: 16px;
                    z-index: 1;
                }
                #imageInfo {
                    position: fixed;
                    bottom: 10px;
                    width: 100%;
                    text-align: center;
                    font-size: 14px;
                    color: #ddd;
                    z-index: 1;
                }
                canvas {
                    display: none;
                }
            </style>
        </head>
        <body>
            <div id="imageCounter">${initialIndex + 1}/${imagePaths.length}</div>
            <img id="imageElement" src="${imagePaths[initialIndex]}" alt="Image Viewer" />
            <canvas id="canvasElement"></canvas>
            <div id="imageName">${imageNames[initialIndex]}</div>
            <div id="imageInfo">Coordinates: (x, y), Color: RGB()</div>
            <script>
                const vscode = acquireVsCodeApi();
                let imageIndex = ${initialIndex};
                let zoomLevel = ${initialZoom};
                let isDragging = false; // 标识是否正在拖动图片
                let startX = 0, startY = 0, translateX = 0, translateY = 0; // 记录拖动的位置

                const images = ${JSON.stringify(imagePaths)};
                const imageNames = ${JSON.stringify(imageNames)};
                const imageElement = document.getElementById('imageElement');
                const imageNameElement = document.getElementById('imageName');
                const imageInfoElement = document.getElementById('imageInfo');
                const imageCounterElement = document.getElementById('imageCounter');
                const canvas = document.getElementById('canvasElement');
                const ctx = canvas.getContext('2d');

                // 恢复保存的状态
                const previousState = vscode.getState();
                if (previousState) {
                    imageIndex = previousState.imageIndex || imageIndex;
                    zoomLevel = previousState.zoomLevel || zoomLevel;
                    imageElement.src = images[imageIndex];
                    imageNameElement.textContent = imageNames[imageIndex];
                    imageCounterElement.textContent = \`\${imageIndex + 1}/\${images.length}\`;
                    imageElement.style.transform = \`scale(\${zoomLevel}) translate(\${translateX}px, \${translateY}px)\`;
                    loadImageToCanvas(images[imageIndex]);  // 确保canvas也加载了正确的图片
                }

                // 加载图片到 canvas 中
                function loadImageToCanvas(src) {
                    const img = new Image();
                    img.crossOrigin = 'anonymous';
                    img.src = src;
                    img.onload = function () {
                        canvas.width = img.width;
                        canvas.height = img.height;
                        ctx.clearRect(0, 0, canvas.width, canvas.height);
                        ctx.drawImage(img, 0, 0);
                    };
                }
                loadImageToCanvas(images[imageIndex]);

                // 更新图片及其名称和计数器
                function updateImage() {
                    const newSrc = images[imageIndex];
                    imageElement.src = newSrc;
                    imageNameElement.textContent = imageNames[imageIndex];
                    imageCounterElement.textContent = \`\${imageIndex + 1}/\${images.length}\`;
                    vscode.setState({ imageIndex, zoomLevel }); // 保存状态
                    loadImageToCanvas(newSrc);  // 更新 canvas 图片
                }

                // 监听滚动事件以实现缩放功能，以鼠标位置为中心
                document.addEventListener('wheel', function(event) {
                    if (event.ctrlKey) {
                        event.preventDefault();
                        
                        const rect = imageElement.getBoundingClientRect();
                        const mouseX = (event.clientX - rect.left) / rect.width;  // 鼠标相对图片的 X 比例
                        const mouseY = (event.clientY - rect.top) / rect.height; // 鼠标相对图片的 Y 比例

                        // 设置 transform-origin 为鼠标位置
                        imageElement.style.transformOrigin = \`\${mouseX * 100}% \${mouseY * 100}%\`;

                        // 调整缩放步长为较小的值
                        zoomLevel += event.deltaY * -0.005; // 更平滑的缩放
                        zoomLevel = Math.min(Math.max(0.3, zoomLevel), 10);
                        imageElement.style.transform = \`scale(\${zoomLevel}) translate(\${translateX}px, \${translateY}px)\`;
                        vscode.setState({ imageIndex, zoomLevel }); // 保存缩放状态
                    } else {
                        if (event.deltaY > 0) {
                            imageIndex = (imageIndex + 1) % images.length;
                        } else {
                            imageIndex = (imageIndex === 0) ? images.length - 1 : imageIndex - 1;
                        }
                        updateImage();
                    }
                });

                // 监听空格键，恢复到100%显示
                document.addEventListener('keydown', function(event) {
                    if (event.code === 'Space') {
                        event.preventDefault();
                        zoomLevel = 1; // 恢复到 100% 显示
                        translateX = 0;
                        translateY = 0;
                        imageElement.style.transformOrigin = '50% 50%'; // 恢复到中心
                        imageElement.style.transform = \`scale(1) translate(0, 0)\`;
                        vscode.setState({ imageIndex, zoomLevel });
                    }
                });

                // 监听鼠标移动事件，显示 RGB 和坐标
                imageElement.addEventListener('mousemove', function(event) {
                    const rect = imageElement.getBoundingClientRect();
                    const x = event.clientX - rect.left;
                    const y = event.clientY - rect.top;

                    // 将显示坐标转换为图像坐标
                    const scaleX = canvas.width / rect.width;
                    const scaleY = canvas.height / rect.height;
                    const imageX = x * scaleX;
                    const imageY = y * scaleY;

                    if (imageX >= 0 && imageY >= 0 && imageX < canvas.width && imageY < canvas.height) {
                        const pixelData = ctx.getImageData(imageX, imageY, 1, 1).data;
                        const rgb = \`RGB(\${pixelData[0]}, \${pixelData[1]}, \${pixelData[2]})\`;
                        imageInfoElement.textContent = \`Coordinates: (\${Math.floor(imageX)}, \${Math.floor(imageY)}), Color: \${rgb}\`;
                    }
                });

                // 实现图片拖动
                imageElement.addEventListener('mousedown', function(event) {
                    if (event.button === 0) {  // 检查是否按下了左键
                        isDragging = true;
                        startX = event.clientX - translateX;
                        startY = event.clientY - translateY;
                    }
                });

                document.addEventListener('mousemove', function(event) {
                    if (isDragging) {
                        translateX = event.clientX - startX;
                        translateY = event.clientY - startY;
                        imageElement.style.transform = \`scale(\${zoomLevel}) translate(\${translateX}px, \${translateY}px)\`;
                    }
                });

                document.addEventListener('mouseup', function(event) {
                    if (event.button === 0) {  // 确保是左键弹起
                        isDragging = false;
                    }
                });

                document.addEventListener('mouseleave', function() {
                    isDragging = false;  // 鼠标离开时也停止拖动
                });

            </script>
        </body>
        </html>
    `;
}

export function deactivate() {}
