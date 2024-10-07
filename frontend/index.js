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

      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      // Serialize the data using @dfinity/candid
      const serializedData = IDL.encode([IDL.Vec(IDL.Nat8)], [Array.from(uint8Array)]);

      // Simulate progress
      let progress = 0;
      const interval = setInterval(() => {
        progress += 10;
        progressBar.style.width = `${Math.min(progress, 90)}%`;
      }, 200);

      try {
        const result = await backend.uploadFile(file.name, file.type, serializedData);
        clearInterval(interval);
        progressBar.style.width = '100%';
        uploadStatus.textContent = result;
        await updateFileList();
      } catch (error) {
        clearInterval(interval);
        console.error('Upload failed:', error);
        uploadStatus.textContent = 'Upload failed: ' + error.message;
        uploadStatus.classList.add('error');
      }
    } catch (error) {
      console.error('File reading failed:', error);
      uploadStatus.textContent = 'File reading failed: ' + error.message;
      uploadStatus.classList.add('error');
    }
  });

  async function updateFileList() {
    try {
      const files = await backend.listFiles();
      fileList.innerHTML = '';
      for (const fileName of files) {
        const li = document.createElement('li');
        li.textContent = fileName;
        const viewButton = document.createElement('button');
        viewButton.textContent = 'View';
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
      const file = await backend.getFile(fileName);
      if (file && file.length > 0) {
        const fileData = file[0];
        console.log('File data received, size:', fileData.data.length);

        const worker = new Worker(new URL('./fileWorker.js', import.meta.url), { type: 'module' });
        
        worker.onmessage = (event) => {
          const { type, data } = event.data;
          
          if (type === 'error') {
            console.error('Worker error:', data);
            alert('Failed to process file: ' + data);
          } else if (type === 'result') {
            displayFileContent(fileData.content_type, data);
          } else if (type === 'progress') {
            updateProgressBar(data);
          }
        };

        worker.postMessage({ fileData });
      } else {
        console.error('File not found or invalid file data');
        alert('File not found or invalid file data');
      }
    } catch (error) {
      console.error('Failed to view file:', error);
      alert('Failed to view file: ' + error.message);
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

  function displayFileContent(contentType, data) {
    if (contentType.startsWith('image/')) {
      const img = document.createElement('img');
      img.src = data;
      img.onerror = (e) => {
        console.error('Failed to load image:', e);
        alert('Failed to load image. Please check the console for more details.');
      };
      img.onload = () => console.log('Image loaded successfully');
      displayInModal(img);
    } else if (contentType.startsWith('text/')) {
      const pre = document.createElement('pre');
      pre.textContent = data;
      displayInModal(pre);
    } else {
      const link = document.createElement('a');
      link.href = data;
      link.download = 'download';
      link.textContent = `Download file`;
      displayInModal(link);
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
