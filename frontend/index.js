import { backend } from 'declarations/backend';
import { AuthClient } from "@dfinity/auth-client";
import { Principal } from "@dfinity/principal";

const FileVault = (function() {
    let authClient;
    let userPrincipal;
    let db;

    const DOM = {
        fileInput: document.getElementById('fileInput'),
        uploadButton: document.getElementById('uploadButton'),
        fileList: document.getElementById('fileList'),
        status: document.getElementById('status'),
        progressBar: document.getElementById('progressBar'),
        progressBarContainer: document.getElementById('progressBarContainer'),
        loginButton: document.getElementById('loginButton'),
        logoutButton: document.getElementById('logoutButton'),
        mainContent: document.getElementById('mainContent')
    };

    async function init() {
        await initIndexedDB();
        await initAuth();
        bindEvents();
    }

    async function initAuth() {
        authClient = await AuthClient.create();
        if (await authClient.isAuthenticated()) {
            userPrincipal = await authClient.getIdentity().getPrincipal();
            showAuthenticatedUI();
        }
    }

    function bindEvents() {
        DOM.loginButton.onclick = login;
        DOM.logoutButton.onclick = logout;
        DOM.uploadButton.addEventListener('click', handleUpload);
        DOM.fileInput.addEventListener('change', updateFileInputLabel);
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
        DOM.loginButton.style.display = 'none';
        DOM.logoutButton.style.display = 'inline-block';
        DOM.mainContent.style.display = 'block';
        DOM.mainContent.classList.add('fade-in');
        updateFileList();
    }

    function showUnauthenticatedUI() {
        DOM.loginButton.style.display = 'inline-block';
        DOM.logoutButton.style.display = 'none';
        DOM.mainContent.style.display = 'none';
        userPrincipal = null;
    }

    async function handleUpload() {
        if (!DOM.fileInput.files.length) {
            updateStatus('Please select a file', 'error');
            return;
        }

        const file = DOM.fileInput.files[0];
        if (file.size <= 1) {
            updateStatus('Error: File must be larger than 1 byte', 'error');
            return;
        }

        try {
            DOM.progressBarContainer.style.display = 'block';
            const content = await readFileAsArrayBuffer(file);
            await saveFileLocally(file.name, file.type, content);
            updateStatus('File uploaded successfully', 'success');
            await updateFileList();
        } catch (error) {
            updateStatus('Upload failed: ' + error.message, 'error');
        } finally {
            DOM.progressBarContainer.style.display = 'none';
            DOM.progressBar.style.width = '0%';
        }
    }

    function updateFileInputLabel() {
        const label = document.querySelector('.file-input-label');
        label.textContent = DOM.fileInput.files.length > 0 ? DOM.fileInput.files[0].name : 'Choose a file';
    }

    function updateStatus(message, type) {
        DOM.status.textContent = message;
        DOM.status.className = `status ${type} fade-in`;
        setTimeout(() => {
            DOM.status.style.opacity = '0';
        }, 3000);
    }

    async function updateFileList() {
        const files = await getAllFiles();
        DOM.fileList.innerHTML = '';
        files.forEach(file => {
            const li = createFileListItem(file.name);
            li.classList.add('fade-in');
            DOM.fileList.appendChild(li);
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
            await updateFileList();
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
            triggerDownload(fileName, file.type, file.content);
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

    async function initIndexedDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('FileStorage', 1);
            request.onerror = event => reject("IndexedDB error: " + event.target.error);
            request.onsuccess = event => {
                db = event.target.result;
                resolve();
            };
            request.onupgradeneeded = event => {
                db = event.target.result;
                db.createObjectStore("files", { keyPath: "name" });
            };
        });
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

    async function getAllFiles() {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(["files"], "readonly");
            const store = transaction.objectStore("files");
            const request = store.getAll();
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
        });
    }

    return { init };
})();

document.addEventListener('DOMContentLoaded', FileVault.init);
