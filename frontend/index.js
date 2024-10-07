import { backend } from 'declarations/backend';
import { IDL } from "@dfinity/candid";

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

    try {
      progressBarContainer.style.display = 'block';
      progressBar.style.width = '0%';
      uploadStatus.textContent = 'Uploading...';
      uploadStatus.classList.remove('error');

      const chunks = await readFileInChunks(file);
      const totalChunks = chunks.length;

      for (let i = 0; i < totalChunks; i++) {
        const chunk = chunks[i];
        const serializedChunk = IDL.encode([IDL.Vec(IDL.Nat8)], [Array.from(chunk)]);
        await backend.uploadFileChunk(file.name, file.type, i, totalChunks, serializedChunk);
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
        const viewButton = document.createElement('button');
        viewButton.textContent = 'View/Download';
        viewButton.addEventListener('click', () => viewFile(fileName));
        li.appendChild(viewButton);
        fileList.appendChild(li);
      }
    } catch (error) {
      console.error('Failed to update file list:', error);
    }
  }

  async function viewFile(fileName) {
    try {
      const fileInfo = await backend.getFileInfo(fileName);
      console.log('File info received:', fileInfo);
      if (fileInfo) {
        const fileData = await downloadFileInChunks(fileName, fileInfo.chunkCount, fileInfo.contentType);
        if (fileData) {
          displayFileContent(fileInfo.name, fileInfo.contentType, fileData);
        } else {
          throw new Error('Failed to download file data');
        }
      } else {
        throw new Error('File not found or invalid file data');
      }
    } catch (error) {
      console.error('Failed to view file:', error);
      alert('Failed to view file: ' + error.message);
    }
  }

  async function downloadFileInChunks(fileName, totalChunks, contentType) {
    updateProgressBar(0);
    try {
      const chunkPromises = Array.from({ length: totalChunks }, (_, i) => 
        backend.getFileChunk(fileName, i)
      );
      const chunks = await Promise.all(chunkPromises);
      updateProgressBar(100);

      const validChunks = chunks.filter(chunk => chunk !== null);
      if (validChunks.length !== totalChunks) {
        console.error(`Expected ${totalChunks} chunks, but received ${validChunks.length} valid chunks`);
        return null;
      }

      const concatenatedChunks = validChunks.reduce((acc, chunk) => {
        const chunkArray = new Uint8Array(chunk);
        const newArray = new Uint8Array(acc.length + chunkArray.length);
        newArray.set(acc);
        newArray.set(chunkArray, acc.length);
        return newArray;
      }, new Uint8Array());

      console.log(`Assembled file size: ${concatenatedChunks.length} bytes`);
      return new Blob([concatenatedChunks], { type: contentType || 'application/octet-stream' });
    } catch (error) {
      console.error('Error downloading file chunks:', error);
      return null;
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

  function displayFileContent(fileName, contentType, fileData) {
    console.log('Displaying file content. Content type:', contentType, 'File size:', fileData.size);
    const url = URL.createObjectURL(fileData);

    if (contentType && contentType.startsWith('image/')) {
      const img = document.createElement('img');
      img.src = url;
      img.onerror = (e) => {
        console.error('Failed to load image:', e);
        alert('Failed to load image. Please check the console for more details.');
      };
      img.onload = () => console.log('Image loaded successfully');
      displayInModal(img);
    } else if (contentType && contentType.startsWith('text/')) {
      fetch(url)
        .then(response => response.text())
        .then(text => {
          const pre = document.createElement('pre');
          pre.textContent = text;
          displayInModal(pre);
        })
        .catch(error => {
          console.error('Failed to load text file:', error);
          alert('Failed to load text file. Please check the console for more details.');
        });
    } else {
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.textContent = `Download ${fileName}`;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      console.log('Download initiated for', fileName);
    }
  }

  function displayInModal(content) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';
    const closeBtn = document.createElement('span');
    closeBtn.className = 'close';
    closeBtn.textContent = '×';
    closeBtn.onclick = () => document.body.removeChild(modal);

    modalContent.appendChild(closeBtn);
    modalContent.appendChild(content);
    modal.appendChild(modalContent);
    document.body.appendChild(modal);

    window.onclick = (event) => {
      if (event.target === modal) {
        document.body.removeChild(modal);
      }
    };
  }

  await updateFileList();
});
