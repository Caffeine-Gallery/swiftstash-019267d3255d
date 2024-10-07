import { backend } from 'declarations/backend';
import { Principal } from "@dfinity/principal";

document.addEventListener('DOMContentLoaded', async () => {
  const fileInput = document.getElementById('fileInput');
  const uploadButton = document.getElementById('uploadButton');
  const fileList = document.getElementById('fileList');
  const status = document.getElementById('status');

  uploadButton.addEventListener('click', async () => {
    if (!fileInput.files.length) {
      status.textContent = 'Please select a file';
      return;
    }

    const file = fileInput.files[0];
    if (file.size <= 1) {
      status.textContent = 'Error: File must be larger than 1 byte';
      return;
    }

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const content = new Uint8Array(e.target.result);
        console.log(`Uploading file: ${file.name}, size: ${content.length} bytes`);
        const result = await backend.uploadFile(file.name, file.type, Array.from(content));
        status.textContent = result;
        updateFileList();
      };
      reader.readAsArrayBuffer(file);
    } catch (error) {
      status.textContent = 'Upload failed: ' + error.message;
    }
  });

  async function updateFileList() {
    const files = await backend.listFiles();
    fileList.innerHTML = '';
    for (const fileName of files) {
      const li = document.createElement('li');
      li.textContent = fileName;
      
      const downloadButton = document.createElement('button');
      downloadButton.textContent = 'Download';
      downloadButton.onclick = () => downloadFile(fileName);
      
      const deleteButton = document.createElement('button');
      deleteButton.textContent = 'Delete';
      deleteButton.onclick = async () => {
        await backend.deleteFile(fileName);
        updateFileList();
      };
      
      li.appendChild(downloadButton);
      li.appendChild(deleteButton);
      fileList.appendChild(li);
    }
  }

  async function downloadFile(fileName) {
    try {
      const fileInfo = await backend.getFileInfo(fileName);
      if (!fileInfo) throw new Error('File not found');

      const content = await backend.getFileContent(fileName);
      if (!content) throw new Error('File is too small or not available for download');
      if (content.length <= 1) throw new Error('File must be larger than 1 byte to download');

      console.log(`Downloading file: ${fileName}, size: ${content.length} bytes`);

      const uint8Array = new Uint8Array(content);
      const blob = new Blob([uint8Array], { type: fileInfo.contentType });
      
      if (blob.size <= 1) throw new Error('File must be larger than 1 byte to download');

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      status.textContent = `File ${fileName} downloaded successfully (${blob.size} bytes)`;
    } catch (error) {
      status.textContent = 'Download failed: ' + error.message;
      console.error('Download error:', error);
    }
  }

  updateFileList();
});
