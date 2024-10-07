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
          await backend.uploadFileChunk(file.name, file.type, BigInt(file.size), BigInt(i), BigInt(totalChunks), serializedChunk);
        } catch (error) {
          console.error(`Error uploading chunk ${i}:`, error);
          throw new Error(`Failed to upload chunk ${i}: ${error.message}`);
        }
        updateProgressBar((i + 1) / totalChunks * 100);
      }

      uploadStatus.textContent = 'File uploaded successfully';
      await updateFileList();
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
        
        li.appendChild(deleteButton);
        fileList.appendChild(li);
      }
    } catch (error) {
      console.error('Failed to update file list:', error);
      uploadStatus.textContent = 'Failed to update file list: ' + error.message;
      uploadStatus.classList.add('error');
    }
  }

  function updateProgressBar(progress) {
    progressBar.style.width = `${progress}%`;
    progressBarContainer.style.display = 'block';
  }

  await updateFileList();
});
