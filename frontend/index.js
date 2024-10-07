import { backend } from 'declarations/backend';

document.addEventListener('DOMContentLoaded', async () => {
  const fileInput = document.getElementById('fileInput');
  const uploadButton = document.getElementById('uploadButton');
  const fileList = document.getElementById('fileList');
  const progressBar = document.getElementById('progressBar');
  const progressBarContainer = document.getElementById('progressBarContainer');

  uploadButton.addEventListener('click', async () => {
    const file = fileInput.files[0];
    if (file) {
      progressBarContainer.style.display = 'block';
      progressBar.style.width = '0%';
      await uploadFileInChunks(file);
      await updateFileList();
    }
  });

  async function uploadFileInChunks(file) {
    const chunkSize = 500 * 1024; // 500KB chunks
    const totalChunks = Math.ceil(file.size / chunkSize);
    let chunkIndex = 0;

    for (let start = 0; start < file.size; start += chunkSize) {
      const chunk = file.slice(start, start + chunkSize);
      const arrayBuffer = await chunk.arrayBuffer();
      const blob = new Blob([new Uint8Array(arrayBuffer)]);
      
      chunkIndex = await backend.uploadFileChunk(file.name, file.type, blob, totalChunks, chunkIndex);
      
      const progress = (chunkIndex / totalChunks) * 100;
      progressBar.style.width = `${progress}%`;
    }
  }

  async function updateFileList() {
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
  }

  async function viewFile(fileName) {
    const file = await backend.getFile(fileName);
    if (file) {
      const blob = new Blob([file[0].data], { type: file[0].content_type });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    }
  }

  await updateFileList();
});
