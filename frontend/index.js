import { backend } from 'declarations/backend';
import { IDL } from "@dfinity/candid";

document.addEventListener('DOMContentLoaded', async () => {
  const fileInput = document.getElementById('fileInput');
  const uploadButton = document.getElementById('uploadButton');
  const fileList = document.getElementById('fileList');
  const progressBar = document.getElementById('progressBar');
  const progressBarContainer = document.getElementById('progressBarContainer');
  const uploadStatus = document.getElementById('uploadStatus');

  uploadButton.addEventListener('click', async () => {
    if (!fileInput.files.length) {
      uploadStatus.textContent = 'Error: Please select a file first';
      uploadStatus.classList.add('error');
      return;
    }

    const file = fileInput.files[0];
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
        console.log('File data:', fileData);  // Log file data for debugging

        // Decode the file data
        const decodedData = new Uint8Array(fileData.data);
        console.log('Decoded data:', decodedData);  // Log decoded data for debugging

        const blob = new Blob([decodedData], { type: fileData.content_type });
        console.log('Blob:', blob);  // Log blob for debugging

        const url = URL.createObjectURL(blob);
        console.log('Created URL:', url);  // Log created URL for debugging

        if (fileData.content_type.startsWith('image/')) {
          const img = document.createElement('img');
          img.src = url;
          img.onerror = () => {
            console.error('Failed to load image');
            alert('Failed to load image. Please check the console for more details.');
          };
          displayInModal(img);
        } else if (fileData.content_type.startsWith('text/')) {
          const text = await blob.text();
          const pre = document.createElement('pre');
          pre.textContent = text;
          displayInModal(pre);
        } else {
          const link = document.createElement('a');
          link.href = url;
          link.download = fileData.name;
          link.textContent = `Download ${fileData.name}`;
          displayInModal(link);
        }
      } else {
        console.error('File not found or invalid file data');
        alert('File not found or invalid file data');
      }
    } catch (error) {
      console.error('Failed to view file:', error);
      alert('Failed to view file: ' + error.message);
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
