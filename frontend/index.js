import { AuthClient } from "@dfinity/auth-client";
import { HttpAgent, Actor } from "@dfinity/agent";
import { idlFactory } from "declarations/backend/backend.did.js";
import { canisterId } from "declarations/backend/index.js";

// Global state
let state = {
    isAuthenticated: false,
    files: [],
    status: { message: '', type: '' }
};

let authClient;

// Initialize auth client
async function initAuth() {
    authClient = await AuthClient.create();
    const isAuthenticated = await authClient.isAuthenticated();
    updateState({ isAuthenticated });
    if (isAuthenticated) {
        updateFileList();
    }
}

// Update state and re-render
function updateState(newState) {
    state = { ...state, ...newState };
    render();
}

// Login function
async function login() {
    console.log("Login function called");
    try {
        const internetIdentityUrl = process.env.INTERNET_IDENTITY_URL || "https://identity.ic0.app/#authorize";
        await authClient.login({
            identityProvider: internetIdentityUrl,
            onSuccess: async () => {
                console.log("Login successful");
                updateState({ isAuthenticated: true });
                updateStatus('Login successful', 'success');
                await updateFileList();
            },
            onError: (error) => {
                console.error("Login failed:", error);
                updateStatus('Login failed: ' + error.message, 'error');
            }
        });
    } catch (error) {
        console.error("Login error:", error);
        updateStatus('Login error: ' + error.message, 'error');
    }
}

// Logout function
async function logout() {
    await authClient.logout();
    updateState({ isAuthenticated: false, files: [] });
    updateStatus('Logged out successfully', 'success');
}

// Update status
function updateStatus(message, type) {
    updateState({ status: { message, type } });
    setTimeout(() => updateState({ status: { message: '', type: '' } }), 3000);
}

// Create authenticated actor
async function createAuthenticatedActor() {
    const identity = authClient.getIdentity();
    const agent = new HttpAgent({ identity });
    
    // When deploying locally, we need to configure the agent to use the local replica
    if (process.env.NODE_ENV !== "production") {
        await agent.fetchRootKey();
    }

    return Actor.createActor(idlFactory, {
        agent,
        canisterId: canisterId,
    });
}

// Update file list
async function updateFileList() {
    try {
        const authenticatedBackend = await createAuthenticatedActor();
        const files = await authenticatedBackend.getAllFiles();
        updateState({ files });
    } catch (error) {
        console.error("Error fetching files:", error);
        updateStatus('Error fetching files: ' + error.message, 'error');
    }
}

// File upload component
function FileUpload() {
    return `
        <section class="upload-section">
            <h2>Upload File</h2>
            <div class="file-upload-container">
                <div class="file-input-wrapper">
                    <input type="file" id="fileInput" class="file-input">
                    <label for="fileInput" class="file-input-label">Choose a file</label>
                </div>
                <button id="uploadButton" class="btn">Upload</button>
            </div>
        </section>
    `;
}

// File list component
function FileList() {
    return `
        <section class="file-list-section">
            <h2>File List</h2>
            <ul class="file-list">
                ${state.files.map((file, index) => `
                    <li>
                        ${file.name}
                        <div class="button-container">
                            <button class="btn btn-small download-btn" data-index="${index}">Download</button>
                            <button class="btn btn-small delete-btn" data-index="${index}">Delete</button>
                        </div>
                    </li>
                `).join('')}
            </ul>
        </section>
    `;
}

// Status message component
function StatusMessage() {
    const { message, type } = state.status;
    return message ? `
        <footer>
            <p class="status ${type}">${message}</p>
        </footer>
    ` : '';
}

// Main App component
function App() {
    return `
        <div class="container">
            <header>
                <h1>FileVault</h1>
            </header>
            <nav class="button-container">
                ${state.isAuthenticated 
                    ? `<button id="logoutButton" class="btn">Logout</button>`
                    : `<button id="loginButton" class="btn">Login with Internet Identity</button>`
                }
            </nav>
            ${state.isAuthenticated ? `
                <main>
                    ${FileUpload()}
                    ${FileList()}
                </main>
            ` : ''}
            ${StatusMessage()}
        </div>
    `;
}

// Event delegation
function handleClick(e) {
    const target = e.target;
    if (target.id === 'loginButton') {
        login();
    } else if (target.id === 'logoutButton') {
        logout();
    } else if (target.id === 'uploadButton') {
        handleUpload();
    } else if (target.classList.contains('download-btn')) {
        const index = parseInt(target.dataset.index);
        downloadFile(state.files[index].name);
    } else if (target.classList.contains('delete-btn')) {
        const index = parseInt(target.dataset.index);
        deleteFile(state.files[index].name);
    }
}

// Render function
function render() {
    const root = document.getElementById('root');
    root.innerHTML = App();
}

// Initialize the app
async function init() {
    await initAuth();
    render();
    document.addEventListener('click', handleClick);
}

// Helper functions
async function handleUpload() {
    const fileInput = document.getElementById('fileInput');
    const file = fileInput.files[0];
    if (!file) {
        updateStatus('Please select a file', 'error');
        return;
    }

    if (file.size <= 1) {
        updateStatus('Error: File must be larger than 1 byte', 'error');
        return;
    }

    try {
        const content = await readFileAsArrayBuffer(file);
        const authenticatedBackend = await createAuthenticatedActor();
        await authenticatedBackend.uploadFile(file.name, Array.from(new Uint8Array(content)));
        updateStatus('File uploaded successfully', 'success');
        await updateFileList();
    } catch (error) {
        updateStatus('Upload failed: ' + error.message, 'error');
    }
}

async function downloadFile(fileName) {
    try {
        const authenticatedBackend = await createAuthenticatedActor();
        const fileData = await authenticatedBackend.downloadFile(fileName);
        if (!fileData) throw new Error('File not found');
        const content = new Uint8Array(fileData).buffer;
        triggerDownload(fileName, 'application/octet-stream', content);
        updateStatus(`File ${fileName} downloaded successfully`, 'success');
    } catch (error) {
        updateStatus('Download failed: ' + error.message, 'error');
    }
}

async function deleteFile(fileName) {
    try {
        const authenticatedBackend = await createAuthenticatedActor();
        await authenticatedBackend.deleteFile(fileName);
        await updateFileList();
        updateStatus(`File ${fileName} deleted successfully`, 'success');
    } catch (error) {
        updateStatus('Delete failed: ' + error.message, 'error');
    }
}

function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = e => reject(e.target.error);
        reader.readAsArrayBuffer(file);
    });
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

// Start the application
document.addEventListener('DOMContentLoaded', init);
