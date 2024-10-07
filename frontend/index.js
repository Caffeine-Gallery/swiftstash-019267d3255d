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
  const MAX_RETRIES = 15;

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
        await backend.uploadFileChunk(file.name, file.type, BigInt(file.size), BigInt(i), BigInt(totalChunks), serializedChunk);
        updateProgressBar((i + 1) / totalChunks * 100);
      }

      uploadStatus.textContent = 'File uploaded successfully';
      await updateFileList();
    } catch (error) {
      console.error('Upload failed:', error);
      uploadStatus.textContent = 'Upload failed: ' + error.message;
      uploadStatus.classList.add('error');
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

        const downloadButton = document.createElement('button');
        downloadButton.textContent = 'Download';
        downloadButton.addEventListener('click', () => downloadFile(fileName));
        li.appendChild(downloadButton);

        fileList.appendChild(li);
      }
    } catch (error) {
      console.error('Failed to update file list:', error);
    }
  }

  async function downloadFile(fileName) {
    try {
      const fileInfo = await backend.getFileInfo(fileName);
      if (fileInfo) {
        if (fileInfo.size === BigInt(0)) {
          throw new Error('File size is 0 bytes');
        }
        const fileData = await downloadFileInChunks(fileInfo);
        if (fileData) {
          const url = URL.createObjectURL(fileData);
          const link = document.createElement('a');
          link.href = url;
          link.download = fileName;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        } else {
          throw new Error('Failed to download file data');
        }
      } else {
        throw new Error('File not found or invalid file data');
      }
    } catch (error) {
      console.error('Failed to download file:', error);
      alert('Failed to download file: ' + error.message);
    }
  }

  async function downloadFileInChunks(fileInfo) {
    updateProgressBar(0);
    try {
      const chunks = [];
      let totalDownloadedSize = 0;
      let successfulChunks = 0;
      for (let i = 0; i < Number(fileInfo.chunkCount); i++) {
        try {
          const chunk = await retryDownloadChunk(fileInfo.name, BigInt(i));
          if (chunk && chunk.length > 0) {
            chunks.push(chunk);
            totalDownloadedSize += chunk.length;
            successfulChunks++;
          } else {
            console.warn(`Empty chunk received for index ${i}`);
          }
        } catch (error) {
          console.error(`Failed to download chunk ${i}:`, error);
        }
        updateProgressBar((i + 1) / Number(fileInfo.chunkCount) * 100);
      }

      if (successfulChunks === 0) {
        throw new Error('No valid chunks were downloaded');
      }

      if (successfulChunks < Number(fileInfo.chunkCount)) {
        console.warn(`Only ${successfulChunks} out of ${fileInfo.chunkCount} chunks were successfully downloaded`);
      }

      const concatenatedChunks = new Uint8Array(totalDownloadedSize);
      let offset = 0;
      for (const chunk of chunks) {
        concatenatedChunks.set(chunk, offset);
        offset += chunk.length;
      }

      if (concatenatedChunks.length === 0) {
        throw new Error('Downloaded file content is empty');
      }

      if (BigInt(concatenatedChunks.length) !== fileInfo.size) {
        console.warn(`File size mismatch. Expected: ${fileInfo.size}, Actual: ${concatenatedChunks.length}`);
      }

      console.log(`Assembled file size: ${concatenatedChunks.length} bytes`);
      return new Blob([concatenatedChunks], { type: fileInfo.contentType || 'application/octet-stream' });
    } catch (error) {
      console.error('Error downloading file chunks:', error);
      throw error;
    }
  }

  async function retryDownloadChunk(fileName, chunkIndex, retries = 0) {
    try {
      const chunk = await backend.getFileChunk(fileName, chunkIndex);
      if (chunk && chunk.length > 0) {
        return new Uint8Array(chunk);
      } else {
        throw new Error('Received empty chunk from backend');
      }
    } catch (error) {
      console.error(`Error downloading chunk ${chunkIndex}:`, error);
      if (retries < MAX_RETRIES) {
        console.log(`Retrying chunk ${chunkIndex}, attempt ${retries + 1}`);
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(1.5, retries))); // Exponential backoff
        return retryDownloadChunk(fileName, chunkIndex, retries + 1);
      }
      throw error;
    }
  }

  function updateProgressBar(progress) {
    progressBar.style.width = `${progress}%`;
    if (progress === 100) {
      setTimeout(() => {
        progressBarContainer.style.display = 'none';
      }, 1000);
    } else {
      progressBarContainer.style.display = 'block';
    }
  }

  await updateFileList();
});
