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
  const fileContentDisplay = document.getElementById('fileContentDisplay');

  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB limit
  const CHUNK_SIZE = 1024 * 1024; // 1MB chunks
  const MAX_RETRY_ATTEMPTS = 5;
  const CHUNK_DOWNLOAD_TIMEOUT = 10000; // 10 seconds

  uploadButton.addEventListener('click', async () => {
    if (!fileInput.files.length) {
      uploadStatus.textContent = 'Error: Please select a file first';
      uploadStatus.classList.add('error');
      return;
    }

    const file = fileInput.files[0];
    if (file.size > MAX_FILE_SIZE) {
      uploadStatus.textContent = 'Error: File size exceeds 10MB limit';
      uploadStatus.classList.add('error');
      return;
    }

    if (file.size === 0) {
      uploadStatus.textContent = 'Error: Cannot upload empty file';
      uploadStatus.classList.add('error');
      return;
    }

    try {
      progressBarContainer.style.display = 'block';
      progressBar.style.width = '0%';
      uploadStatus.textContent = 'Uploading...';
      uploadStatus.classList.remove('error');

      const chunks = await readFileInChunks(file);
      const totalChunks = chunks.length;

      for (let i = 0; i < totalChunks; i++) {
        const chunk = chunks[i];
        if (chunk.length === 0) {
          throw new Error('Empty chunk detected during upload');
        }
        const serializedChunk = Array.from(chunk);
        try {
          const result = await backend.uploadFileChunk(file.name, file.type, BigInt(file.size), BigInt(i), BigInt(totalChunks), serializedChunk);
          if (result.startsWith("Error:")) {
            throw new Error(result);
          }
        } catch (error) {
          console.error(`Error uploading chunk ${i}:`, error);
          throw new Error(`Failed to upload chunk ${i}: ${error.message}`);
        }
        updateProgressBar((i + 1) / totalChunks * 100);
      }

      const integrityCheck = await backend.verifyFileIntegrity(file.name);
      if (!integrityCheck) {
        throw new Error('File integrity check failed after upload');
      }

      uploadStatus.textContent = 'File uploaded successfully';
      await updateFileList();
      await displayFileContent(file.name);
    } catch (error) {
      console.error('Upload failed:', error);
      uploadStatus.textContent = 'Upload failed: ' + error.message;
      uploadStatus.classList.add('error');
    } finally {
      progressBarContainer.style.display = 'none';
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
        deleteButton.onclick = async () => {
          if (confirm(`Are you sure you want to delete ${fileName}?`)) {
            try {
              await backend.deleteFile(fileName);
              li.remove();
              uploadStatus.textContent = `${fileName} deleted successfully`;
              uploadStatus.classList.remove('error');
            } catch (error) {
              console.error('Delete failed:', error);
              uploadStatus.textContent = 'Delete failed: ' + error.message;
              uploadStatus.classList.add('error');
            }
          }
        };
        
        const downloadButton = document.createElement('button');
        downloadButton.textContent = 'Download';
        downloadButton.onclick = () => downloadFile(fileName);
        
        const viewButton = document.createElement('button');
        viewButton.textContent = 'View';
        viewButton.onclick = () => displayFileContent(fileName);
        
        const debugButton = document.createElement('button');
        debugButton.textContent = 'Debug';
        debugButton.onclick = async () => {
          try {
            const debugInfo = await backend.debugFileChunks(fileName);
            console.log('Debug info for', fileName, ':', debugInfo);
            alert('Debug info logged to console');
          } catch (error) {
            console.error('Debug failed:', error);
            alert('Debug failed: ' + error.message);
          }
        };
        
        li.appendChild(deleteButton);
        li.appendChild(downloadButton);
        li.appendChild(viewButton);
        li.appendChild(debugButton);
        fileList.appendChild(li);
      }
    } catch (error) {
      console.error('Failed to update file list:', error);
      uploadStatus.textContent = 'Failed to update file list: ' + error.message;
      uploadStatus.classList.add('error');
    }
  }

  async function downloadFile(fileName) {
    try {
      progressBarContainer.style.display = 'block';
      progressBar.style.width = '0%';
      uploadStatus.textContent = 'Downloading...';
      uploadStatus.classList.remove('error');

      const fileInfo = await backend.getFileInfo(fileName);
      if (!fileInfo) {
        throw new Error('File not found');
      }

      const integrityCheck = await backend.verifyFileIntegrity(fileName);
      if (!integrityCheck) {
        throw new Error('File integrity check failed before download');
      }

      const totalChunks = Number(fileInfo.chunkCount);
      const chunks = [];
      let totalSize = 0;
      let validChunksDownloaded = 0;

      for (let i = 0; i < totalChunks; i++) {
        let chunkData = null;
        for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt++) {
          try {
            chunkData = await Promise.race([
              backend.getFileChunk(fileName, BigInt(i)),
              new Promise((_, reject) => setTimeout(() => reject(new Error('Chunk download timeout')), CHUNK_DOWNLOAD_TIMEOUT))
            ]);
            if (chunkData) {
              const chunk = new Uint8Array(chunkData);
              if (chunk.length > 0) {
                chunks.push(chunk);
                totalSize += chunk.length;
                validChunksDownloaded++;
                break;
              } else {
                console.warn(`Empty chunk received for index ${i}, retrying...`);
              }
            }
          } catch (error) {
            console.warn(`Attempt ${attempt + 1} failed for chunk ${i}:`, error.message);
            await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt))); // Exponential backoff
          }
        }
        if (!chunkData) {
          console.error(`Failed to download chunk ${i} after ${MAX_RETRY_ATTEMPTS} attempts`);
        }
        updateProgressBar((i + 1) / totalChunks * 100);
      }

      if (validChunksDownloaded === 0) {
        throw new Error('No valid chunks were downloaded');
      }

      if (chunks.length !== totalChunks) {
        console.warn(`Expected ${totalChunks} chunks, but received ${chunks.length}`);
      }

      const blob = new Blob(chunks, { type: fileInfo.contentType });
      if (blob.size === 0) {
        throw new Error('Created blob is empty');
      }

      if (blob.size !== Number(fileInfo.size)) {
        console.warn(`File size mismatch. Expected: ${fileInfo.size}, Actual: ${blob.size}`);
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      uploadStatus.textContent = `Download completed (${validChunksDownloaded}/${totalChunks} chunks)`;
    } catch (error) {
      console.error('Download failed:', error);
      uploadStatus.textContent = 'Download failed: ' + error.message;
      uploadStatus.classList.add('error');
    } finally {
      progressBarContainer.style.display = 'none';
    }
  }

  async function displayFileContent(fileName) {
    try {
      const fileInfo = await backend.getFileInfo(fileName);
      if (!fileInfo) {
        throw new Error('File not found');
      }

      const content = await backend.getFileContent(fileName);
      if (!content) {
        throw new Error('Failed to retrieve file content');
      }

      const blob = new Blob([new Uint8Array(content)], { type: fileInfo.contentType });
      const url = URL.createObjectURL(blob);

      fileContentDisplay.innerHTML = '';

      if (fileInfo.contentType.startsWith('image/')) {
        const img = document.createElement('img');
        img.src = url;
        img.style.maxWidth = '100%';
        fileContentDisplay.appendChild(img);
      } else if (fileInfo.contentType.startsWith('text/') || fileInfo.contentType === 'application/json') {
        const text = await blob.text();
        const pre = document.createElement('pre');
        pre.textContent = text;
        fileContentDisplay.appendChild(pre);
      } else {
        fileContentDisplay.textContent = 'File content cannot be displayed. Use the download button to access the file.';
      }

      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to display file content:', error);
      fileContentDisplay.textContent = 'Failed to display file content: ' + error.message;
    }
  }

  function updateProgressBar(progress) {
    progressBar.style.width = `${progress}%`;
    progressBarContainer.style.display = 'block';
  }

  await updateFileList();
});
