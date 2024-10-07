self.onmessage = async (event) => {
  const { fileData } = event.data;

  try {
    const decodedData = new Uint8Array(fileData.data);

    if (fileData.content_type.startsWith('image/')) {
      const base64 = btoa(String.fromCharCode.apply(null, decodedData));
      const dataUrl = `data:${fileData.content_type};base64,${base64}`;
      self.postMessage({ type: 'result', data: dataUrl });
    } else if (fileData.content_type.startsWith('text/')) {
      const text = new TextDecoder().decode(decodedData);
      self.postMessage({ type: 'result', data: text });
    } else {
      const blob = new Blob([decodedData], { type: fileData.content_type });
      const url = URL.createObjectURL(blob);
      self.postMessage({ type: 'result', data: url });
    }
  } catch (error) {
    self.postMessage({ type: 'error', data: error.message });
  }
};
