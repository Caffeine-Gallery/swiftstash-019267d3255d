import { backend } from 'declarations/backend';
import { AuthClient } from "@dfinity/auth-client";
import { Principal } from "@dfinity/principal";

// Custom useState hook
function useState(initialState) {
    let state = initialState;
    const listeners = new Set();

    const setState = (newState) => {
        state = typeof newState === 'function' ? newState(state) : newState;
        listeners.forEach(listener => listener(state));
    };

    const getState = () => state;

    const subscribe = (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
    };

    return [getState, setState, subscribe];
}

// Custom useEffect hook
function useEffect(effect, dependencies) {
    let cleanup;
    const runEffect = () => {
        if (cleanup) cleanup();
        cleanup = effect();
    };

    if (!dependencies) {
        runEffect();
    } else {
        let oldDeps = [];
        return (newDeps) => {
            if (newDeps.some((dep, i) => dep !== oldDeps[i])) {
                runEffect();
                oldDeps = newDeps;
            }
        };
    }
}

// IndexedDB operations
let db;

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

// Components
function FileUpload({ onUpload, updateStatus }) {
    const [getFile, setFile] = useState(null);
    const [getProgress, setProgress] = useState(0);

    const handleFileChange = (event) => {
        setFile(event.target.files[0]);
    };

    const handleUpload = async () => {
        const file = getFile();
        if (!file) {
            updateStatus('Please select a file', 'error');
            return;
        }

        if (file.size <= 1) {
            updateStatus('Error: File must be larger than 1 byte', 'error');
            return;
        }

        try {
            setProgress(0);
            const content = await readFileAsArrayBuffer(file);
            await saveFileLocally(file.name, file.type, content);
            updateStatus('File uploaded successfully', 'success');
            onUpload();
        } catch (error) {
            updateStatus('Upload failed: ' + error.message, 'error');
        } finally {
            setProgress(0);
        }
    };

    return {
        html: `
            <section class="upload-section">
                <h2>Upload File</h2>
                <div class="file-upload-container">
                    <div class="file-input-wrapper">
                        <input type="file" id="fileInput" class="file-input">
                        <label for="fileInput" class="file-input-label">${getFile() ? getFile().name : 'Choose a file'}</label>
                    </div>
                    <button id="uploadButton" class="btn">Upload</button>
                </div>
                ${getProgress() > 0 ? `
                    <div class="progress-bar-container">
                        <div class="progress-bar" style="width: ${getProgress()}%"></div>
                    </div>
                ` : ''}
            </section>
        `,
        listeners: {
            '#fileInput': { change: handleFileChange },
            '#uploadButton': { click: handleUpload }
        }
    };
}

function FileList({ files, onDownload, onDelete }) {
    return {
        html: `
            <section class="file-list-section">
                <h2>File List</h2>
                <ul class="file-list">
                    ${files.map((file, index) => `
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
        `,
        listeners: {
            '.download-btn': { click: (e) => onDownload(files[e.target.dataset.index].name) },
            '.delete-btn': { click: (e) => onDelete(files[e.target.dataset.index].name) }
        }
    };
}

function StatusMessage({ message, type }) {
    return {
        html: message ? `
            <footer>
                <p class="status ${type}">${message}</p>
            </footer>
        ` : '',
        listeners: {}
    };
}

function App() {
    const [getIsAuthenticated, setIsAuthenticated] = useState(false);
    const [getFiles, setFiles] = useState([]);
    const [getStatus, setStatus] = useState({ message: '', type: '' });
    let authClient;

    const initAuth = async () => {
        authClient = await AuthClient.create();
        const isAuthenticated = await authClient.isAuthenticated();
        setIsAuthenticated(isAuthenticated);
        if (isAuthenticated) {
            updateFileList();
        }
    };

    const login = async () => {
        await authClient.login({
            identityProvider: "https://identity.ic0.app/#authorize",
            onSuccess: () => {
                setIsAuthenticated(true);
                updateFileList();
            },
        });
    };

    const logout = async () => {
        await authClient.logout();
        setIsAuthenticated(false);
    };

    const updateStatus = (message, type) => {
        setStatus({ message, type });
        setTimeout(() => setStatus({ message: '', type: '' }), 3000);
    };

    const updateFileList = async () => {
        const files = await getAllFiles();
        setFiles(files);
    };

    const downloadFile = async (fileName) => {
        try {
            const file = await getFileLocally(fileName);
            if (!file) throw new Error('File not found');
            triggerDownload(fileName, file.type, file.content);
            updateStatus(`File ${fileName} downloaded successfully`, 'success');
        } catch (error) {
            updateStatus('Download failed: ' + error.message, 'error');
        }
    };

    const deleteFile = async (fileName) => {
        await deleteFileLocally(fileName);
        await updateFileList();
    };

    useEffect(() => {
        initAuth();
        initIndexedDB();
    }, []);

    const fileUploadComponent = FileUpload({ onUpload: updateFileList, updateStatus });
    const fileListComponent = FileList({ files: getFiles(), onDownload: downloadFile, onDelete: deleteFile });
    const statusMessageComponent = StatusMessage(getStatus());

    return {
        html: `
            <div class="container">
                <header>
                    <h1>FileVault</h1>
                </header>
                <nav class="button-container">
                    ${getIsAuthenticated() 
                        ? `<button id="logoutButton" class="btn">Logout</button>`
                        : `<button id="loginButton" class="btn">Login</button>`
                    }
                </nav>
                ${getIsAuthenticated() ? `
                    <main>
                        ${fileUploadComponent.html}
                        ${fileListComponent.html}
                    </main>
                ` : ''}
                ${statusMessageComponent.html}
            </div>
        `,
        listeners: {
            '#loginButton': { click: login },
            '#logoutButton': { click: logout },
            ...fileUploadComponent.listeners,
            ...fileListComponent.listeners,
            ...statusMessageComponent.listeners
        }
    };
}

// Render function
function render(component, container) {
    const { html, listeners } = component();
    container.innerHTML = html;
    Object.entries(listeners).forEach(([selector, events]) => {
        const elements = container.querySelectorAll(selector);
        Object.entries(events).forEach(([event, handler]) => {
            elements.forEach(element => element.addEventListener(event, handler));
        });
    });
}

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    const root = document.getElementById('root');
    render(App, root);
});

// Helper functions
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
