import { backend } from 'declarations/backend';
import { IDL } from "@dfinity/candid";
import { Principal } from "@dfinity/principal";

document.addEventListener('DOMContentLoaded', async () => {
  const fileInput = document.getElementById('fileInput');
  const uploadButton = document.getElementById('uploadButton');
  const fileList = document.getElementById('fileList');
  const progressBar = document.getElementById('progressBar');
  const progressBarContainer = document.getElementById('progressBarContainer');
  const uploadStatus = document.getElementById('uploadStatus');

  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB limit
  const CHUNK_SIZE = 1024 * 1024; // 1MB chunks

  uploadButton.addEventListener('click', async () => {
    if (!fileInput.files.length) {
      showStatus('Error: Please select a file first', true);
      return;
    }

    const file = fileInput.files[0];
    if (file.size > MAX_FILE_SIZE) {
      showStatus('Error: File size exceeds 10MB limit', true);
      return;
    }

    if (file.size === 0) {
      showStatus('Error: Cannot upload empty file', true);
      return;
    }

    try {
      showProgress(true);
      showStatus('Uploading...', false);

      const chunks = await readFileInChunks(file);
      const totalChunks = chunks.length;

      for (let i = 0; i < totalChunks; i++) {
        const chunk = chunks[i];
        if (chunk.length === 0) {
          throw new Error('Empty chunk detected during upload');
        }
        const serializedChunk = Array.from(chunk);
        const result = await backend.uploadFileChunk(file.name, file.type, BigInt(file.size), BigInt(i), BigInt(totalChunks), serializedChunk);
        if (result.startsWith("Error:")) {
          throw new Error(result);
        }
        updateProgressBar((i + 1) / totalChunks * 100);
      }

      const integrityCheck = await backend.verifyFileIntegrity(file.name);
      if (!integrityCheck) {
        throw new Error('File integrity check failed after upload');
      }

      showStatus('File uploaded successfully', false);
      await updateFileList();
    } catch (error) {
      console.error('Upload failed:', error);
      showStatus('Upload failed: ' + error.message, true);
    } finally {
      showProgress(false);
    }
  });

  async function readFileInChunks(file) {
    const chunks = [];
    let offset = 0;
    while (offset < file.size) {
      const chunk = await readChunk(file, offset, CHUNK_SIZE);
      chunks.push(chunk);
      offset += chunk.length;
    }
    return chunks;
  }

  function readChunk(file, offset, length) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(new Uint8Array(e.target.result));
      reader.onerror = reject;
      reader.readAsArrayBuffer(file.slice(offset, offset + length));
    });
  }

  async function updateFileList() {
    try {
      const files = await backend.listFiles();
      fileList.innerHTML = '';
      for (const fileName of files) {
        const li = document.createElement('li');
        li.textContent = fileName;
        
        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'Delete';
        deleteButton.classList.add('btn', 'btn-delete');
        deleteButton.onclick = async () => {
          if (confirm(`Are you sure you want to delete ${fileName}?`)) {
            try {
              await backend.deleteFile(fileName);
              li.remove();
              showStatus(`${fileName} deleted successfully`, false);
            } catch (error) {
              console.error('Delete failed:', error);
              showStatus('Delete failed: ' + error.message, true);
            }
          }
        };
        
        const downloadButton = document.createElement('button');
        downloadButton.textContent = 'Download';
        downloadButton.classList.add('btn', 'btn-download');
        downloadButton.onclick = () => downloadFile(fileName);
        
        li.appendChild(deleteButton);
        li.appendChild(downloadButton);
        fileList.appendChild(li);
      }
    } catch (error) {
      console.error('Failed to update file list:', error);
      showStatus('Failed to update file list: ' + error.message, true);
    }
  }

  async function downloadFile(fileName) {
    try {
      showProgress(true);
      showStatus('Downloading...', false);

      const fileInfo = await backend.getFileInfo(fileName);
      if (!fileInfo) {
        throw new Error('File not found');
      }

      const content = await backend.getFileContent(fileName);
      if (!content) {
        throw new Error('Failed to retrieve file content');
      }

      const blob = new Blob([new Uint8Array(content)], { type: fileInfo.contentType || 'application/octet-stream' });
      if (blob.size === 0) {
        throw new Error('Created blob is empty');
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showStatus('Download completed', false);
    } catch (error) {
      console.error('Download failed:', error);
      showStatus('Download failed: ' + error.message, true);
    } finally {
      showProgress(false);
    }
  }

  function updateProgressBar(progress) {
    progressBar.style.width = `${progress}%`;
  }

  function showProgress(show) {
    progressBarContainer.style.display = show ? 'block' : 'none';
    if (show) {
      progressBar.style.width = '0%';
    }
  }

  function showStatus(message, isError) {
    uploadStatus.textContent = message;
    uploadStatus.classList.toggle('error', isError);
  }

  await updateFileList();
});
