import { backend } from 'declarations/backend';

document.addEventListener('DOMContentLoaded', async () => {
  const fileInput = document.getElementById('fileInput');
  const uploadButton = document.getElementById('uploadButton');
  const fileList = document.getElementById('fileList');

  uploadButton.addEventListener('click', async () => {
    const file = fileInput.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const arrayBuffer = e.target.result;
        const blob = new Blob([new Uint8Array(arrayBuffer)]);
        await backend.uploadFile(file.name, file.type, blob);
        await updateFileList();
      };
      reader.readAsArrayBuffer(file);
    }
  });

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
