import { backend } from 'declarations/backend';
import { AuthClient } from "@dfinity/auth-client";
import { Principal } from "@dfinity/principal";

let db;
let authClient;
let userPrincipal;

document.addEventListener('DOMContentLoaded', async () => {
  const fileInput = document.getElementById('fileInput');
  const uploadButton = document.getElementById('uploadButton');
  const fileList = document.getElementById('fileList');
  const status = document.getElementById('status');
  const progressBar = document.getElementById('progressBar');
  const progressBarContainer = document.getElementById('progressBarContainer');
  const loginButton = document.getElementById('loginButton');
  const logoutButton = document.getElementById('logoutButton');
  const mainContent = document.getElementById('mainContent');

  initIndexedDB();
  await initAuth();

  loginButton.onclick = login;
  logoutButton.onclick = logout;
  uploadButton.addEventListener('click', handleUpload);
  fileInput.addEventListener('change', updateFileInputLabel);

  async function initAuth() {
    authClient = await AuthClient.create();
    if (await authClient.isAuthenticated()) {
      userPrincipal = await authClient.getIdentity().getPrincipal();
      showAuthenticatedUI();
    }
  }

  async function login() {
    await authClient.login({
      identityProvider: "https://identity.ic0.app/#authorize",
      onSuccess: () => {
        userPrincipal = authClient.getIdentity().getPrincipal();
        showAuthenticatedUI();
      },
    });
  }

  async function logout() {
    await authClient.logout();
    showUnauthenticatedUI();
  }

  function showAuthenticatedUI() {
    loginButton.style.display = 'none';
    logoutButton.style.display = 'inline-block';
    mainContent.style.display = 'block';
    updateFileList();
  }

  function showUnauthenticatedUI() {
    loginButton.style.display = 'inline-block';
    logoutButton.style.display = 'none';
    mainContent.style.display = 'none';
    userPrincipal = null;
  }

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
      await backend.uploadFile(file.name, file.type, Array.from(new Uint8Array(content)));
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
    const files = await backend.listFiles(userPrincipal);
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
      await backend.deleteFile(fileName);
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
      const fileInfo = await backend.getFileInfo(userPrincipal, fileName);
      if (!fileInfo) throw new Error('File not found');
      const content = new Uint8Array(fileInfo.content).buffer;
      triggerDownload(fileName, fileInfo.contentType, content);
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

  async function deleteFileLocally(name) {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["files"], "readwrite");
      const store = transaction.objectStore("files");
      const request = store.delete(name);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }
});
