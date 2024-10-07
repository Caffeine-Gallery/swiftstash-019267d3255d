import { backend } from 'declarations/backend';
import { AuthClient } from "@dfinity/auth-client";
import { Principal } from "@dfinity/principal";

const e = React.createElement;

function App() {
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);
  const [files, setFiles] = React.useState([]);
  const [status, setStatus] = React.useState({ message: '', type: '' });
  const [selectedFile, setSelectedFile] = React.useState(null);
  const [uploadProgress, setUploadProgress] = React.useState(0);

  const authClient = React.useRef(null);
  const userPrincipal = React.useRef(null);

  React.useEffect(() => {
    initAuth();
  }, []);

  async function initAuth() {
    authClient.current = await AuthClient.create();
    if (await authClient.current.isAuthenticated()) {
      userPrincipal.current = await authClient.current.getIdentity().getPrincipal();
      setIsAuthenticated(true);
      updateFileList();
    }
  }

  async function login() {
    await authClient.current.login({
      identityProvider: "https://identity.ic0.app/#authorize",
      onSuccess: () => {
        userPrincipal.current = authClient.current.getIdentity().getPrincipal();
        setIsAuthenticated(true);
        updateFileList();
      },
    });
  }

  async function logout() {
    await authClient.current.logout();
    setIsAuthenticated(false);
    userPrincipal.current = null;
  }

  async function handleUpload() {
    if (!selectedFile) {
      updateStatus('Please select a file', 'error');
      return;
    }

    if (selectedFile.size <= 1) {
      updateStatus('Error: File must be larger than 1 byte', 'error');
      return;
    }

    try {
      setUploadProgress(0);
      const content = await readFileAsArrayBuffer(selectedFile);
      await saveFileLocally(selectedFile.name, selectedFile.type, content);
      updateStatus('File uploaded successfully', 'success');
      await updateFileList();
    } catch (error) {
      updateStatus('Upload failed: ' + error.message, 'error');
    } finally {
      setUploadProgress(0);
    }
  }

  function updateStatus(message, type) {
    setStatus({ message, type });
    setTimeout(() => setStatus({ message: '', type: '' }), 3000);
  }

  async function updateFileList() {
    const files = await getAllFiles();
    setFiles(files);
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

  async function deleteFile(fileName) {
    await deleteFileLocally(fileName);
    await updateFileList();
  }

  function FileUpload() {
    return e('section', { className: 'upload-section' },
      e('h2', null, 'Upload File'),
      e('div', { className: 'file-upload-container' },
        e('div', { className: 'file-input-wrapper' },
          e('input', {
            type: 'file',
            id: 'fileInput',
            className: 'file-input',
            onChange: (event) => setSelectedFile(event.target.files[0])
          }),
          e('label', { htmlFor: 'fileInput', className: 'file-input-label' },
            selectedFile ? selectedFile.name : 'Choose a file'
          )
        ),
        e('button', { className: 'btn', onClick: handleUpload }, 'Upload')
      ),
      uploadProgress > 0 && e('div', { className: 'progress-bar-container' },
        e('div', { className: 'progress-bar', style: { width: `${uploadProgress}%` } })
      )
    );
  }

  function FileList() {
    return e('section', { className: 'file-list-section' },
      e('h2', null, 'File List'),
      e('ul', { className: 'file-list' },
        files.map(file => 
          e('li', { key: file.name },
            file.name,
            e('div', { className: 'button-container' },
              e('button', { className: 'btn btn-small', onClick: () => downloadFile(file.name) }, 'Download'),
              e('button', { className: 'btn btn-small', onClick: () => deleteFile(file.name) }, 'Delete')
            )
          )
        )
      )
    );
  }

  return e('div', { className: 'container' },
    e('header', null, e('h1', null, 'FileVault')),
    e('nav', { className: 'button-container' },
      isAuthenticated
        ? e('button', { className: 'btn', onClick: logout }, 'Logout')
        : e('button', { className: 'btn', onClick: login }, 'Login')
    ),
    isAuthenticated && e('main', null,
      e(FileUpload),
      e(FileList)
    ),
    status.message && e('footer', null,
      e('p', { className: `status ${status.type}` }, status.message)
    )
  );
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

// Initialize IndexedDB and render the app
initIndexedDB().then(() => {
  const root = document.getElementById('root');
  ReactDOM.render(e(App), root);
});
