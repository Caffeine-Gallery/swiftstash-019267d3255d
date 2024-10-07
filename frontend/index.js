import { backend } from 'declarations/backend';
import { Principal } from "@dfinity/principal";

let db;

document.addEventListener('DOMContentLoaded', async () => {
  const fileInput = document.getElementById('fileInput');
  const uploadButton = document.getElementById('uploadButton');
  const fileList = document.getElementById('fileList');
  const status = document.getElementById('status');

  // Initialize IndexedDB
  const dbName = 'FileStorage';
  const dbVersion = 1;
  const request = indexedDB.open(dbName, dbVersion);

  request.onerror = (event) => {
    console.error("IndexedDB error:", event.target.error);
  };

  request.onsuccess = (event) => {
    db = event.target.result;
    updateFileList();
  };

  request.onupgradeneeded = (event) => {
    db = event.target.result;
    const objectStore = db.createObjectStore("files", { keyPath: "name" });
  };

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
        
        // Save file locally
        await saveFileLocally(file.name, file.type, content);
        
        // Upload to backend
        const result = await backend.uploadFile(file.name, file.type, Array.from(content));
        status.textContent = result;
        updateFileList();
      };
      reader.readAsArrayBuffer(file);
    } catch (error) {
      status.textContent = 'Upload failed: ' + error.message;
    }
  });

  async function saveFileLocally(name, type, content) {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["files"], "readwrite");
      const objectStore = transaction.objectStore("files");
      const request = objectStore.put({ name, type, content });
      
      request.onerror = (event) => reject(event.target.error);
      request.onsuccess = (event) => resolve();
    });
  }

  async function getFileLocally(name) {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["files"], "readonly");
      const objectStore = transaction.objectStore("files");
      const request = objectStore.get(name);
      
      request.onerror = (event) => reject(event.target.error);
      request.onsuccess = (event) => resolve(event.target.result);
    });
  }

  async function deleteFileLocally(name) {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["files"], "readwrite");
      const objectStore = transaction.objectStore("files");
      const request = objectStore.delete(name);
      
      request.onerror = (event) => reject(event.target.error);
      request.onsuccess = (event) => resolve();
    });
  }

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
        await deleteFileLocally(fileName);
        updateFileList();
      };
      
      li.appendChild(downloadButton);
      li.appendChild(deleteButton);
      fileList.appendChild(li);
    }
  }

  async function downloadFile(fileName) {
    try {
      let fileInfo, content;

      // Try to get file from local storage first
      const localFile = await getFileLocally(fileName);
      if (localFile && localFile.content.length > 1) {
        fileInfo = { name: localFile.name, contentType: localFile.type };
        content = localFile.content;
        console.log(`Retrieved file from local storage: ${fileName}`);
      } else {
        // If not in local storage, get from backend
        fileInfo = await backend.getFileInfo(fileName);
        if (!fileInfo) throw new Error('File not found');

        content = await backend.getFileContent(fileName);
        if (!content) throw new Error('File is too small or not available for download');
        if (content.length <= 1) throw new Error('File must be larger than 1 byte to download');

        console.log(`Downloaded file from backend: ${fileName}, size: ${content.length} bytes`);
      }

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
