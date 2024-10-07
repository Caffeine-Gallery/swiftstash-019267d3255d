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
    try {
        const identity = authClient.getIdentity();
        const agent = new HttpAgent({ identity });
        
        // When deploying locally, we need to configure the agent to use the local replica
        if (process.env.NODE_ENV !== "production") {
            await agent.fetchRootKey();
        }

        const actor = Actor.createActor(idlFactory, {
            agent,
            canisterId: canisterId,
        });

        // Verify that the actor has the expected methods
        if (typeof actor.listFiles !== 'function') {
            throw new Error('Backend actor does not have a listFiles method');
        }

        return actor;
    } catch (error) {
        console.error("Error creating authenticated actor:", error);
        throw error;
    }
}

// Update file list
async function updateFileList() {
    try {
        const authenticatedBackend = await createAuthenticatedActor();
        // Assuming listFiles doesn't require any arguments
        const files = await authenticatedBackend.listFiles();
        updateState({ files });
    } catch (error) {
        console.error("Error fetching files:", error);
        updateStatus('Error fetching files: ' + error.message, 'error');
    }
}

// File upload component
function FileUpload() {
    return (
        <section className="upload-section">
            <h2>Upload File</h2>
            <div className="file-upload-container">
                <div className="file-input-wrapper">
                    <input type="file" id="fileInput" className="file-input" />
                    <label htmlFor="fileInput" className="file-input-label">Choose a file</label>
                </div>
                <button id="uploadButton" className="btn">Upload</button>
            </div>
        </section>
    );
}

// File list component
function FileList() {
    return (
        <section className="file-list-section">
            <h2>File List</h2>
            <ul className="file-list">
                {state.files.map((file, index) => (
                    <li key={index}>
                        {file.name}
                        <div className="button-container">
                            <button className="btn btn-small download-btn" data-index={index}>Download</button>
                            <button className="btn btn-small delete-btn" data-index={index}>Delete</button>
                        </div>
                    </li>
                ))}
            </ul>
        </section>
    );
}

// Status message component
function StatusMessage() {
    const { message, type } = state.status;
    return message ? (
        <footer>
            <p className={`status ${type}`}>{message}</p>
        </footer>
    ) : null;
}

// Main App component
function App() {
    return (
        <div className="container">
            <header>
                <h1>FileVault</h1>
            </header>
            <nav className="button-container">
                {state.isAuthenticated 
                    ? <button id="logoutButton" className="btn" onClick={logout}>Logout</button>
                    : <button id="loginButton" className="btn" onClick={login}>Login with Internet Identity</button>
                }
            </nav>
            {state.isAuthenticated && (
                <main>
                    <FileUpload />
                    <FileList />
                </main>
            )}
            <StatusMessage />
        </div>
    );
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
        // Convert ArrayBuffer to Uint8Array
        const uint8Array = new Uint8Array(content);
        // Pass file name and content as separate arguments
        await authenticatedBackend.uploadFile(file.name, uint8Array);
        updateStatus('File uploaded successfully', 'success');
        await updateFileList();
    } catch (error) {
        console.error("Upload error:", error);
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

// Render function
function render() {
    const root = document.getElementById('root');
    root.innerHTML = '';
    const appElement = App();
    root.appendChild(appElement);
}

// Initialize the app
async function init() {
    await initAuth();
    render();
    document.addEventListener('click', (e) => {
        if (e.target.id === 'uploadButton') {
            handleUpload();
        } else if (e.target.classList.contains('download-btn')) {
            const index = parseInt(e.target.dataset.index);
            downloadFile(state.files[index].name);
        } else if (e.target.classList.contains('delete-btn')) {
            const index = parseInt(e.target.dataset.index);
            deleteFile(state.files[index].name);
        }
    });
}

// Start the application
document.addEventListener('DOMContentLoaded', init);
