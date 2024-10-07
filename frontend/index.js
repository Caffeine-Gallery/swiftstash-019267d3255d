import { backend } from 'declarations/backend';

let db;

document.addEventListener('DOMContentLoaded', async () => {
  const fileInput = document.getElementById('fileInput');
  const uploadButton = document.getElementById('uploadButton');
  const fileList = document.getElementById('fileList');
  const status = document.getElementById('status');
  const progressBar = document.getElementById('progressBar');
  const progressBarContainer = document.getElementById('progressBarContainer');

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
      progressBarContainer.style.display = 'block';
      const content = await readFileAsArrayBuffer(file);
      await saveFileLocally(file.name, file.type, content);
      updateStatus('File uploaded successfully', 'success');
      updateFileList();
    } catch (error) {
      updateStatus('Upload failed: ' + error.message, 'error');
    } finally {
      progressBarContainer.style.display = 'none';
      progressBar.style.width = '0%';
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
    const files = await listFilesLocally();
    fileList.innerHTML = '';
    files.forEach(fileName => {
      const li = createFileListItem(fileName);
      fileList.appendChild(li);
    });
  }

  function createFileListItem(fileName) {
    const li = document.createElement('li');
    li.textContent = fileName;
    
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'button-container';
    
    const downloadButton = createButton('Download', () => downloadFile(fileName));
    const deleteButton = createButton('Delete', async () => {
      await deleteFileLocally(fileName);
      updateFileList();
    });
    
    buttonContainer.appendChild(downloadButton);
    buttonContainer.appendChild(deleteButton);
    li.appendChild(buttonContainer);
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
      const file = await getFileLocally(fileName);
      if (!file) throw new Error('File not found');
      triggerDownload(file.name, file.type, file.content);
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
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["files"], "readwrite");
      const store = transaction.objectStore("files");
      const request = store.put({ name, type, content });
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async function getFileLocally(name) {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["files"], "readonly");
      const store = transaction.objectStore("files");
      const request = store.get(name);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  async function deleteFileLocally(name) {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["files"], "readwrite");
      const store = transaction.objectStore("files");
      const request = store.delete(name);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async function listFilesLocally() {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["files"], "readonly");
      const store = transaction.objectStore("files");
      const request = store.getAllKeys();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  updateFileList();
});
