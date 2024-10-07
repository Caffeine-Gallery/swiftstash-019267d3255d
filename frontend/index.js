import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { AuthClient } from "@dfinity/auth-client";
import { HttpAgent, Actor } from "@dfinity/agent";
import { idlFactory } from "declarations/backend/backend.did.js";
import { canisterId } from "declarations/backend/index.js";

const App = () => {
    const [state, setState] = useState({
        isAuthenticated: false,
        files: [],
        status: { message: '', type: '' }
    });

    const [authClient, setAuthClient] = useState(null);

    useEffect(() => {
        initAuth();
    }, []);

    const initAuth = async () => {
        const client = await AuthClient.create();
        setAuthClient(client);
        const isAuthenticated = await client.isAuthenticated();
        setState(prevState => ({ ...prevState, isAuthenticated }));
        if (isAuthenticated) {
            updateFileList();
        }
    };

    const updateStatus = (message, type) => {
        setState(prevState => ({ ...prevState, status: { message, type } }));
        setTimeout(() => setState(prevState => ({ ...prevState, status: { message: '', type: '' } })), 3000);
    };

    const createAuthenticatedActor = async () => {
        try {
            const identity = authClient.getIdentity();
            const agent = new HttpAgent({ identity });
            
            if (process.env.NODE_ENV !== "production") {
                await agent.fetchRootKey();
            }

            const actor = Actor.createActor(idlFactory, {
                agent,
                canisterId: canisterId,
            });

            if (typeof actor.listFiles !== 'function') {
                throw new Error('Backend actor does not have a listFiles method');
            }

            return actor;
        } catch (error) {
            console.error("Error creating authenticated actor:", error);
            throw error;
        }
    };

    const updateFileList = async () => {
        try {
            const authenticatedBackend = await createAuthenticatedActor();
            const files = await authenticatedBackend.listFiles();
            setState(prevState => ({ ...prevState, files }));
        } catch (error) {
            console.error("Error fetching files:", error);
            updateStatus('Error fetching files: ' + error.message, 'error');
        }
    };

    const login = async () => {
        console.log("Login function called");
        try {
            const internetIdentityUrl = process.env.INTERNET_IDENTITY_URL || "https://identity.ic0.app/#authorize";
            await authClient.login({
                identityProvider: internetIdentityUrl,
                onSuccess: async () => {
                    console.log("Login successful");
                    setState(prevState => ({ ...prevState, isAuthenticated: true }));
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
    };

    const logout = async () => {
        await authClient.logout();
        setState(prevState => ({ ...prevState, isAuthenticated: false, files: [] }));
        updateStatus('Logged out successfully', 'success');
    };

    const handleUpload = async (event) => {
        const file = event.target.files[0];
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
            const uint8Array = new Uint8Array(content);
            await authenticatedBackend.uploadFile(file.name, uint8Array);
            updateStatus('File uploaded successfully', 'success');
            await updateFileList();
        } catch (error) {
            console.error("Upload error:", error);
            updateStatus('Upload failed: ' + error.message, 'error');
        }
    };

    const downloadFile = async (fileName) => {
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
    };

    const deleteFile = async (fileName) => {
        try {
            const authenticatedBackend = await createAuthenticatedActor();
            await authenticatedBackend.deleteFile(fileName);
            await updateFileList();
            updateStatus(`File ${fileName} deleted successfully`, 'success');
        } catch (error) {
            updateStatus('Delete failed: ' + error.message, 'error');
        }
    };

    const readFileAsArrayBuffer = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.onerror = e => reject(e.target.error);
            reader.readAsArrayBuffer(file);
        });
    };

    const triggerDownload = (fileName, contentType, content) => {
        const blob = new Blob([content], { type: contentType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const FileUpload = () => (
        <section className="upload-section">
            <h2>Upload File</h2>
            <div className="file-upload-container">
                <div className="file-input-wrapper">
                    <input type="file" id="fileInput" className="file-input" onChange={handleUpload} />
                    <label htmlFor="fileInput" className="file-input-label">Choose a file</label>
                </div>
            </div>
        </section>
    );

    const FileList = () => (
        <section className="file-list-section">
            <h2>File List</h2>
            <ul className="file-list">
                {state.files.map((file, index) => (
                    <li key={index}>
                        {file.name}
                        <div className="button-container">
                            <button className="btn btn-small download-btn" onClick={() => downloadFile(file.name)}>Download</button>
                            <button className="btn btn-small delete-btn" onClick={() => deleteFile(file.name)}>Delete</button>
                        </div>
                    </li>
                ))}
            </ul>
        </section>
    );

    const StatusMessage = () => {
        const { message, type } = state.status;
        return message ? (
            <footer>
                <p className={`status ${type}`}>{message}</p>
            </footer>
        ) : null;
    };

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
};

ReactDOM.render(<App />, document.getElementById('root'));
