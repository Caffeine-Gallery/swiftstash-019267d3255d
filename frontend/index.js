import { backend } from 'declarations/backend';

let db;

document.addEventListener('DOMContentLoaded', async () => {
  const fileInput = document.getElementById('fileInput');
  const uploadButton = document.getElementById('uploadButton');
  const fileList = document.getElementById('fileList');
  const status = document.getElementById('status');

  initIndexedDB();

  uploadButton.addEventListener('click', handleUpload);
  fileInput.addEventListener('change', updateFileInputLabel);

  async function handleUpload() {
    if (!fileInput.files.length) {
      updateStatus('Please select a file', 'error');
      return;
    }

    const file = fileInput.files[0];
    if (file.size <= 1) {
      updateStatus('Error: File must be larger than 1 byte', 'error');
      return;
    }

    try {
      const content = await readFileAsArrayBuffer(file);
      await saveFileLocally(file.name, file.type, content);
      const result = await backend.uploadFile(file.name, file.type, Array.from(new Uint8Array(content)));
      updateStatus(result, 'success');
      updateFileList();
    } catch (error) {
      updateStatus('Upload failed: ' + error.message, 'error');
    }
  }

  function updateFileInputLabel() {
    const label = document.querySelector('.file-input-label');
    label.textContent = fileInput.files.length > 0 ? fileInput.files[0].name : 'Choose a file';
  }

  function updateStatus(message, type) {
    status.textContent = message;
    status.className = `status ${type}`;
  }

  async function updateFileList() {
    const files = await backend.listFiles();
    fileList.innerHTML = '';
    files.forEach(fileName => {
      const li = createFileListItem(fileName);
      fileList.appendChild(li);
    });
  }

  function createFileListItem(fileName) {
    const li = document.createElement('li');
    li.textContent = fileName;
    
    const downloadButton = createButton('Download', () => downloadFile(fileName));
    const deleteButton = createButton('Delete', async () => {
      await backend.deleteFile(fileName);
      await deleteFileLocally(fileName);
      updateFileList();
    });
    
    li.appendChild(downloadButton);
    li.appendChild(deleteButton);
    return li;
  }

  function createButton(text, onClick) {
    const button = document.createElement('button');
    button.textContent = text;
    button.className = 'btn btn-small';
    button.onclick = onClick;
    return button;
  }

  async function downloadFile(fileName) {
    try {
      const localFile = await getFileLocally(fileName);
      if (localFile && localFile.content.byteLength > 1) {
        triggerDownload(localFile.name, localFile.type, localFile.content);
      } else {
        const fileInfo = await backend.getFileInfo(fileName);
        if (!fileInfo) throw new Error('File not found');
        triggerDownload(fileName, fileInfo.contentType, new Uint8Array(fileInfo.content).buffer);
      }
      updateStatus(`File ${fileName} downloaded successfully`, 'success');
    } catch (error) {
      updateStatus('Download failed: ' + error.message, 'error');
    }
  }

  function triggerDownload(fileName, contentType, content) {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function initIndexedDB() {
    const request = indexedDB.open('FileStorage', 1);
    request.onerror = event => console.error("IndexedDB error:", event.target.error);
    request.onsuccess = event => {
      db = event.target.result;
      updateFileList();
    };
    request.onupgradeneeded = event => {
      db = event.target.result;
      db.createObjectStore("files", { keyPath: "name" });
    };
  }

  function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.onerror = e => reject(e.target.error);
      reader.readAsArrayBuffer(file);
    });
  }

  async function saveFileLocally(name, type, content) {
    const transaction = db.transaction(["files"], "readwrite");
    const store = transaction.objectStore("files");
    await store.put({ name, type, content });
  }

  async function getFileLocally(name) {
    const transaction = db.transaction(["files"], "readonly");
    const store = transaction.objectStore("files");
    return await store.get(name);
  }

  async function deleteFileLocally(name) {
    const transaction = db.transaction(["files"], "readwrite");
    const store = transaction.objectStore("files");
    await store.delete(name);
  }

  updateFileList();
});
