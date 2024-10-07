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
    const file = fileInput.files[0];
    if (file) {
      try {
        progressBarContainer.style.display = 'block';
        progressBar.style.width = '0%';
        uploadStatus.textContent = 'Uploading...';

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
        }
      } catch (error) {
        console.error('File reading failed:', error);
        uploadStatus.textContent = 'File reading failed: ' + error.message;
      }
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
      if (file) {
        const blob = new Blob([file[0].data], { type: file[0].content_type });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
      }
    } catch (error) {
      console.error('Failed to view file:', error);
    }
  }

  await updateFileList();
});
